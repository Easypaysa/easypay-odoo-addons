from odoo import models, fields, api


class Payment(models.Model):
    _inherit = 'pos.payment'

    easypay_terminalid = fields.Char()
    udid = fields.Char()
    retrieval_reference_number = fields.Char()
    pan = fields.Char()
    entry_mode = fields.Char()
    approval_code = fields.Char()
    card_name = fields.Char()
    signature_required = fields.Boolean()
    merchant = fields.Float()
    amount_authorized = fields.Text()
    payment_log = fields.Char()
    receipt_url = fields.Char(string='Receipt URL', help='URL link to the payment receipt')
    use_payment_terminal = fields.Char(compute="_compute_payment_terminal",
                                       store=True)

    @api.depends('payment_method_id')
    def _compute_payment_terminal(self):
        for rec in self:
            value = ''
            if rec.payment_method_id and rec.payment_method_id.use_payment_terminal:
                value = rec.payment_method_id.use_payment_terminal
            rec.use_payment_terminal = value

    def _export_for_ui(self, payment):
        result = super()._export_for_ui(payment)
        result.update(
            easypay_terminalid=payment.easypay_terminalid,
            udid=payment.udid,
            retrieval_reference_number=payment.retrieval_reference_number,
            pan=payment.pan,
            entry_mode=payment.entry_mode,
            approval_code=payment.approval_code,
            card_name=payment.card_name,
            merchant=payment.merchant,
            signature_required=payment.signature_required,
            amount_authorized=payment.amount_authorized,
            receipt_url=payment.receipt_url
        )
        return result
