# coding: utf-8

from odoo import fields, models, api, _


class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    easypay_terminalid = fields.Char(string='Easypay Terminal ID')

    def _get_payment_terminal_selection(self):
        return super()._get_payment_terminal_selection() + [('easypay', 'EASYPAY')]

