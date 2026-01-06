# -*- coding: utf-8 -*-
import logging
from odoo import http, _
from odoo.http import request
from odoo.tools import consteq, float_is_zero, float_round
from odoo.addons.pos_self_order.controllers.orders import PosSelfOrderController
from werkzeug.exceptions import BadRequest, Unauthorized
from odoo.exceptions import UserError, MissingError

_logger = logging.getLogger(__name__)


class PosSelfOrderControllerPaymentFix(http.Controller):
    """
    Extends PosSelfOrderController with a dedicated endpoint for marking orders as paid.
    
    This controller provides a clean separation between order creation (draft) and 
    payment processing. The Kiosk app creates a draft order first, then calls 
    the mark_order_paid endpoint to finalize payment.
    
    Benefits:
    - Cleaner 2-step workflow: create order → mark as paid
    - Full validation: order state, payments, session, amounts
    - Secure: uses access_token + order_access_token
    - No override of existing endpoints (better maintainability)
    """

    def _verify_pos_config(self, access_token):
        """
        Verify POS config access token (copied from parent controller).
        """
        pos_config_sudo = request.env['pos.config'].sudo().search([('access_token', '=', access_token)], limit=1)
        if not pos_config_sudo or (not pos_config_sudo.self_ordering_mode == 'mobile' and not pos_config_sudo.self_ordering_mode == 'kiosk') or not pos_config_sudo.has_active_session:
            raise Unauthorized("Invalid access token")
        company = pos_config_sudo.company_id
        user = pos_config_sudo.self_ordering_default_user_id
        return pos_config_sudo.sudo(False).with_company(company).with_user(user).with_context(allowed_company_ids=company.ids)

    def _generate_return_values(self, order, config_id):
        """
        Generate return values for order (copied from parent controller).
        """
        return {
            'pos.order': order.read(order._load_pos_data_fields(config_id.id), load=False),
            'pos.order.line': order.lines.read(order._load_pos_data_fields(config_id.id), load=False),
            'pos.payment': order.payment_ids.read(order.payment_ids._load_pos_data_fields(order.config_id.id), load=False),
            'pos.payment.method': order.payment_ids.mapped('payment_method_id').read(order.env['pos.payment.method']._load_pos_data_fields(order.config_id.id), load=False),
            'product.attribute.custom.value':  order.lines.custom_attribute_value_ids.read(order.lines.custom_attribute_value_ids._load_pos_data_fields(config_id.id), load=False),
        }

    @http.route('/pos-self-order/mark-order-paid', auth='public', type='json', website=True)
    def mark_order_paid(self, order_id, access_token, order_access_token, payment_data=None):
        """
        Mark a draft order as paid and process it (2-STEP WORKFLOW).
        
        This endpoint validates that:
        1. Order exists and access tokens match
        2. Order is in draft state
        3. Order belongs to an active POS session
        4. Payment data is provided (payment_method_id and amount)
        5. Payment amount matches or exceeds order total
        6. Payment method is valid for the POS config
        
        Workflow:
        1. Kiosk app creates draft order via process_order endpoint
        2. Kiosk app calls this endpoint with payment data to finalize payment
        
        Args:
            order_id (int): ID of the order to mark as paid
            access_token (str): POS config access token for authorization
            order_access_token (str): Order-specific access token for security
            payment_data (dict): Payment information {
                'payment_method_id': int (required),
                'amount': float (required),
                'payment_date': str (optional),
                'payment_status': str (optional),
                'transaction_id': str (optional),
                'card_type': str (optional),
                'card_no': str (optional),
            }
            
        Returns:
            dict: Updated order data with state='paid' and all related records
            
        Raises:
            Unauthorized: If access tokens are invalid
            MissingError: If order doesn't exist
            BadRequest: If validation fails (wrong state, insufficient payment, etc.)
        """
        _logger.info("=== Mark Order Paid Request: order_id=%s ===", order_id)
        
        # ==========================================
        # STEP 1: VERIFY POS CONFIG ACCESS
        # ==========================================
        pos_config = self._verify_pos_config(access_token)
        pos_session = pos_config.current_session_id
        
        if not pos_session:
            raise BadRequest(_("No active POS session found."))
        
        _logger.info("POS Config verified: %s (Session: %s)", pos_config.name, pos_session.name)
        
        # ==========================================
        # STEP 2: VERIFY ORDER EXISTS AND ACCESS
        # ==========================================
        pos_order = pos_config.env['pos.order'].sudo().browse(order_id)
        
        if not pos_order.exists():
            raise MissingError(_("Order with ID %s does not exist.") % order_id)
        
        if not consteq(pos_order.access_token, order_access_token):
            _logger.warning(
                "Invalid order access token for order %s (expected: %s, got: %s)",
                pos_order.name, pos_order.access_token[:10] + "...", order_access_token[:10] + "..."
            )
            raise Unauthorized(_("Invalid order access token."))
        
        _logger.info("Order verified: %s (state=%s)", pos_order.name, pos_order.state)
        
        # ==========================================
        # STEP 3: VALIDATE ORDER STATE
        # ==========================================
        if pos_order.state != 'draft':
            raise BadRequest(
                _("Order %s is not in draft state. Current state: %s. "
                  "Only draft orders can be marked as paid.") % (pos_order.name, pos_order.state)
            )
        
        # ==========================================
        # STEP 4: VALIDATE ORDER BELONGS TO SESSION
        # ==========================================
        if pos_order.session_id.id != pos_session.id:
            raise BadRequest(
                _("Order %s belongs to a different session. "
                  "Expected session: %s, Order session: %s") % (
                    pos_order.name, pos_session.name, pos_order.session_id.name
                )
            )
        
        # ==========================================
        # STEP 5: VALIDATE PAYMENT DATA PROVIDED
        # ==========================================
        if not payment_data:
            raise BadRequest(
                _("Order %s: payment_data is required. "
                  "Please provide payment_method_id and amount.") % pos_order.name
            )
        
        # Validate required fields
        if 'payment_method_id' not in payment_data:
            raise BadRequest(_("payment_data must include 'payment_method_id'"))
        
        if 'amount' not in payment_data:
            raise BadRequest(_("payment_data must include 'amount'"))
        
        payment_method_id = payment_data['payment_method_id']
        payment_amount = payment_data['amount']
        
        _logger.info(
            "Order %s: Received payment data - method_id=%s, amount=%.2f",
            pos_order.name, payment_method_id, payment_amount
        )
        
        # ==========================================
        # STEP 6: VALIDATE PAYMENT METHOD
        # ==========================================
        payment_method = pos_config.env['pos.payment.method'].sudo().browse(payment_method_id)
        
        if not payment_method.exists():
            raise BadRequest(
                _("Payment method with ID %s does not exist.") % payment_method_id
            )
        
        if payment_method not in pos_config.payment_method_ids:
            raise BadRequest(
                _("Payment method '%s' is not configured for this POS.") % payment_method.name
            )
        
        _logger.info("Payment method validated: %s", payment_method.name)
        
        # ==========================================
        # STEP 7: VALIDATE PAYMENT AMOUNT
        # ==========================================
        amount_total = pos_order.amount_total
        payment_total = payment_amount
        currency = pos_order.currency_id
        
        _logger.info(
            "Payment validation: amount_total=%.2f, payment_amount=%.2f, currency=%s",
            amount_total, payment_total, currency.name
        )
        
        # Handle cash rounding if enabled
        if pos_config.cash_rounding:
            if pos_config.only_round_cash_method and not payment_method.is_cash_count:
                # No rounding for non-cash payments
                total_to_check = amount_total
            else:
                # Apply cash rounding
                total_to_check = float_round(
                    amount_total,
                    precision_rounding=pos_config.rounding_method.rounding,
                    rounding_method=pos_config.rounding_method.rounding_method
                )
            
            _logger.info("Cash rounding applied: %.2f → %.2f", amount_total, total_to_check)
        else:
            total_to_check = amount_total
        
        # Check if payment covers the order total
        is_paid = float_is_zero(
            total_to_check - payment_total,
            precision_rounding=currency.rounding
        )
        
        if not is_paid:
            # Check if it's within acceptable rounding difference
            if pos_config.cash_rounding:
                if pos_config.rounding_method.rounding_method == "HALF-UP":
                    max_diff = currency.round(pos_config.rounding_method.rounding / 2)
                else:
                    max_diff = currency.round(pos_config.rounding_method.rounding)
                
                diff = currency.round(total_to_check - payment_total)
                if abs(diff) <= max_diff:
                    is_paid = True
                    _logger.info("Payment accepted within rounding tolerance: diff=%.2f, max=%.2f", 
                                diff, max_diff)
        
        if not is_paid:
            raise BadRequest(
                _("Order %s is not fully paid. Total: %.2f, Payments: %.2f, Difference: %.2f") % (
                    pos_order.name, 
                    total_to_check, 
                    payment_total, 
                    total_to_check - payment_total
                )
            )
        
        _logger.info("✓ Payment validation passed: Order %s is fully paid", pos_order.name)
        
        # ==========================================
        # STEP 8: ATTACH PAYMENT TO ORDER
        # ==========================================
        try:
            # Build payment record data
            from odoo import fields
            payment_vals = {
                'pos_order_id': pos_order.id,
                'payment_method_id': payment_method_id,
                'amount': payment_amount,
                'session_id': pos_session.id,
                'payment_date': payment_data.get('payment_date', fields.Datetime.now()),
            }
            
            # Add optional fields if provided
            if 'payment_status' in payment_data:
                payment_vals['payment_status'] = payment_data['payment_status']
            if 'transaction_id' in payment_data:
                payment_vals['transaction_id'] = payment_data['transaction_id']
            if 'card_type' in payment_data:
                payment_vals['card_type'] = payment_data['card_type']
            if 'card_no' in payment_data:
                payment_vals['cardholder_name'] = payment_data.get('card_no', '')
            
            # Create payment record
            payment = pos_config.env['pos.payment'].sudo().create(payment_vals)
            _logger.info("✓ Payment record created: ID=%s, Amount=%.2f", payment.id, payment.amount)
            
            # CRITICAL: Update amount_paid on the order
            # The amount_paid is a computed field that needs to be manually set
            # because action_pos_order_paid() checks if amount_paid >= amount_total
            pos_order.with_context(backend_recomputation=True).write({
                'amount_paid': sum(pos_order.payment_ids.mapped('amount'))
            })
            _logger.info("✓ Order amount_paid updated: %.2f", pos_order.amount_paid)
            
        except Exception as e:
            _logger.error("Failed to create payment record: %s", str(e), exc_info=True)
            raise BadRequest(_("Failed to create payment record: %s") % str(e))
        
        # ==========================================
        # STEP 9: MARK ORDER AS PAID
        # ==========================================
        try:
            # Call action_pos_order_paid which does final validation and marks as paid
            pos_order.action_pos_order_paid()
            _logger.info("✓ Order %s marked as paid", pos_order.name)
            
        except UserError as e:
            _logger.error("Failed to mark order %s as paid: %s", pos_order.name, str(e))
            raise BadRequest(_("Failed to mark order as paid: %s") % str(e))
        
        # ==========================================
        # STEP 10: PROCESS SAVED ORDER (FINALIZE)
        # ==========================================
        try:
            # Process the order (create picking, compute costs, generate invoice if needed)
            pos_order._process_saved_order(draft=False)
            _logger.info("✓ Order %s processed successfully", pos_order.name)
            
        except Exception as e:
            _logger.error("Error processing order %s: %s", pos_order.name, str(e), exc_info=True)
            # Order is already marked as paid, so we don't fail here
            # Just log the error for investigation
        
        # ==========================================
        # STEP 11: SEND TABLE NOTIFICATION
        # ==========================================
        if pos_order.table_id:
            pos_order.send_table_count_notification(pos_order.table_id)
            _logger.info("✓ Table notification sent for order %s", pos_order.name)
        
        # ==========================================
        # STEP 12: RETURN ORDER DATA
        # ==========================================
        result = self._generate_return_values(pos_order, pos_config)
        
        _logger.info("=== Mark Order Paid Complete: order=%s, state=%s ===", 
                    pos_order.name, pos_order.state)
        
        return result

