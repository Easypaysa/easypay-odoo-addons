# coding: utf-8

from odoo import fields, models, api


class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    easypay_terminalid = fields.Char(string='Easypay Terminal ID')
    easypay_card_scheme_ids = fields.Many2many(
        'easypay.card.scheme',
        'pos_payment_method_card_scheme_rel',
        'payment_method_id',
        'card_scheme_id',
        string='Card Schemes',
        help='Select the card schemes accepted by this EasyPay payment method'
    )

    def _get_payment_terminal_selection(self):
        return super()._get_payment_terminal_selection() + [('easypay', 'EASYPAY')]

    @api.model
    def _load_pos_data_fields(self, config):
        fields = super()._load_pos_data_fields(config)
        fields.extend(['easypay_terminalid', 'easypay_card_scheme_ids'])
        return fields

    @api.onchange('use_payment_terminal')
    def _onchange_use_payment_terminal_easypay(self):
        """Clear card schemes when switching away from EasyPay terminal."""
        if self.use_payment_terminal != 'easypay':
            self.easypay_card_scheme_ids = [(5, 0, 0)]

