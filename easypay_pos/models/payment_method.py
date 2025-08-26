from odoo import models, fields


class PaymentMethod(models.Model):
    _inherit = "pos.payment.method"

    def _get_payment_terminal_selection(self):
        return super()._get_payment_terminal_selection() + [
            ('easypay', 'EASYPAY')
        ]
    easypay_teminalid = fields.Char()

    
