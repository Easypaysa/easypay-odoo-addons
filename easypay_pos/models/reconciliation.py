from odoo import models, fields, api
from datetime import datetime
import pytz


class DailyReconciliation(models.Model):
    _name = 'daily.reconciliation'
    _description = 'Daily Reconciliation'

    name = fields.Char(string="Reference", required=True,
                       default=lambda self: self.env['ir.sequence'].next_by_code('daily.reconciliation'))
    date = fields.Datetime(string='Date', readonly=True, index=True, default=fields.Datetime.now)
    is_balanced = fields.Boolean(string="Reconciliation Completed")
    qr_code = fields.Char(string="QR Code")
    merchant_id = fields.Char(string="Merchant")
    terminal_id = fields.Char(string="Terminal ID")
    user_id = fields.Many2one('res.users', string="User", default=lambda self: self.env.uid)
    note = fields.Text(string="Notes")
    session_id = fields.Many2one('pos.session', string='Session', readonly=True)

    # Detail fields
    purchase_total = fields.Float(string="Purchase Total")
    purchase_count = fields.Integer(string="Purchase Count")
    refund_total = fields.Float(string="Refund Total")
    refund_count = fields.Integer(string="Refund Count")
    purchase_reversal_total = fields.Float(string="Purchase Reversal Total")
    purchase_reversal_count = fields.Integer(string="Purchase Reversal Count")
    refund_reversal_total = fields.Float(string="Refund Reversal Total")
    refund_reversal_count = fields.Integer(string="Refund Reversal Count")
    total_total = fields.Float(string="Grand Total")
    total_count = fields.Integer(string="Total Count")

    # One2many relation to scheme lines
    scheme_ids = fields.One2many('daily.reconciliation.scheme', 'balance_id', string="Card Scheme Lines")
    @api.model
    def create_from_json(self, data, session_id):
        """Create a reconciliation record (and related scheme lines) from a raw JSON data."""
        # تحويل التاريخ من صيغة dd/mm/yyyy إلى كائن date
        try:
            # Get date and time strings from JSON
            date_str = data.get('date')  # e.g. "06/03/2023" (dd/mm/yyyy)
            time_str = data.get('time')  # e.g. "10:46:04"

            # Combine them and convert to a datetime object, then format to ISO string
            # dt_obj = datetime.strptime(date_str + " " + time_str, '%d/%m/%Y %H:%M:%S')
            # iso_datetime = dt_obj.strftime('%Y-%m-%d %H:%M:%S')

            # Combine date and time into one string
            local_datetime_str = f"{date_str} {time_str}"  # "14/03/2025 18:05:32"

            # Parse the local datetime (assuming the format is dd/mm/yyyy HH:MM:SS)
            local_dt = datetime.strptime(local_datetime_str, '%d/%m/%Y %H:%M:%S')

            # Define the local timezone (e.g., Asia/Riyadh for UTC+3)
            local_tz = pytz.timezone('Asia/Riyadh')

            # Localize the datetime (attach the timezone to the naive datetime)
            localized_dt = local_tz.localize(local_dt)

            # Convert to UTC
            utc_dt = localized_dt.astimezone(pytz.UTC)

            # Format datetime in ISO format (which Odoo expects)
            iso_datetime = utc_dt.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            iso_datetime = fields.Date.context_today(self)

        # استخراج تفاصيل العمليات
        details = data.get('details', {})
        purchase = details.get('purchase', {})
        refund = details.get('refund', {})
        purchase_reversal = details.get('purchase_reversal', {})
        refund_reversal = details.get('refund_reversal', {})
        total_detail = details.get('total', {})

        # تجهيز بيانات خطوط الموازنة (schemes)
        scheme_lines = []
        for scheme in data.get('schemes', []):
            pos = scheme.get('pos', {})
            host = scheme.get('host', {})
            line_vals = {
                'name': '{} / {}'.format(
                    scheme.get('name', {}).get('label', {}).get('arabic', ''),
                    scheme.get('name', {}).get('label', {}).get('english', '')
                ),
                'pos_debit_total': float(pos.get('debit', {}).get('total', '0.00')),
                'pos_debit_count': int(pos.get('debit', {}).get('count', 0)),
                'pos_credit_total': float(pos.get('credit', {}).get('total', '0.00')),
                'pos_credit_count': int(pos.get('credit', {}).get('count', 0)),
                'pos_total_total': float(pos.get('total', {}).get('total', '0.00')),
                'pos_total_count': int(pos.get('total', {}).get('count', 0)),
                # 'host_debit_total': float(host.get('debit', {}).get('total', '0.00')),
                # 'host_debit_count': int(host.get('debit', {}).get('count', 0)),
                # 'host_credit_total': float(host.get('credit', {}).get('total', '0.00')),
                # 'host_credit_count': int(host.get('credit', {}).get('count', 0)),
                # 'host_total_total': float(host.get('total', {}).get('total', '0.00')),
                # 'host_total_count': int(host.get('total', {}).get('count', 0)),
            }
            scheme_lines.append((0, 0, line_vals))

        vals = {
            'name': data.get('id'),
            'date': iso_datetime,
            'is_balanced': data.get('is_balanced', {}).get('value', False),
            'merchant_id': data.get('merchant', {}).get('id', False),
            'terminal_id': data.get('card_acceptor_terminal_id'),
            'qr_code': data.get('qr_code'),
            'session_id': session_id,
            'purchase_total': float(purchase.get('total', '0.00')),
            'purchase_count': int(purchase.get('count', 0)),
            'refund_total': float(refund.get('total', '0.00')),
            'refund_count': int(refund.get('count', 0)),
            'purchase_reversal_total': float(purchase_reversal.get('total', '0.00')),
            'purchase_reversal_count': int(purchase_reversal.get('count', 0)),
            'refund_reversal_total': float(refund_reversal.get('total', '0.00')),
            'refund_reversal_count': int(refund_reversal.get('count', 0)),
            'total_total': float(total_detail.get('total', '0.00')),
            'total_count': int(total_detail.get('count', 0)),
            'scheme_ids': scheme_lines,
            'note':data,
        }
        return self.create(vals)


class DailyBalanceScheme(models.Model):
    _name = 'daily.reconciliation.scheme'
    _description = 'Reconciliation Scheme Line'

    balance_id = fields.Many2one('daily.reconciliation', string="Reconciliation")
    name = fields.Char(string="Card Type", required=True)

    # POS fields
    pos_debit_total = fields.Float(string="Debit Total")
    pos_debit_count = fields.Integer(string="Debit Count")
    pos_credit_total = fields.Float(string="Credit Total")
    pos_credit_count = fields.Integer(string="Credit Count")
    pos_total_total = fields.Float(string="Total")
    pos_total_count = fields.Integer(string="Total Count")

    # # Host fields
    # host_debit_total = fields.Float(string="Host Debit Total")
    # host_debit_count = fields.Integer(string="Host Debit Count")
    # host_credit_total = fields.Float(string="Host Credit Total")
    # host_credit_count = fields.Integer(string="Host Credit Count")
    # host_total_total = fields.Float(string="Host Total")
    # host_total_count = fields.Integer(string="Host Total Count")
