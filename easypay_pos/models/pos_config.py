# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class PosConfig(models.Model):
    _inherit = 'pos.config'

    easy_connection_type = fields.Selection([('not_secure', 'Not Secure'), ('secure', 'Secure')], string="Connection Default Type", default='not_secure')
    easy_default_ip = fields.Char(string="Default IP", default="localhost")
    easy_force_done = fields.Boolean(string='Enable Force Done')
    easy_auto_validate = fields.Boolean(string='Enable Auto Validate')
    enable_auto_print_payment_transaction = fields.Boolean(string='Enable Auto Print Payment Transaction Receipt')
    is_easypay = fields.Boolean( compute='_compute_is_easypay')


    @api.depends('payment_method_ids')
    def _compute_is_easypay(self):
        for config in self:
            config.is_easypay = bool(config.payment_method_ids.filtered(lambda method: method.use_payment_terminal == 'easypay'))

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    easy_connection_type = fields.Selection(related='pos_config_id.easy_connection_type',readonly=False)
    easy_default_ip = fields.Char(related='pos_config_id.easy_default_ip',readonly=False)
    easy_force_done = fields.Boolean(related='pos_config_id.easy_force_done',readonly=False)
    easy_auto_validate = fields.Boolean(related='pos_config_id.easy_auto_validate',readonly=False)
    enable_auto_print_payment_transaction = fields.Boolean(related='pos_config_id.enable_auto_print_payment_transaction',readonly=False)
    is_easypay = fields.Boolean(related='pos_config_id.is_easypay',readonly=False)

    @api.depends('payment_method_ids')
    def _compute_is_easypay(self):
        for config in self:
            config.is_easypay = bool(
                config.payment_method_ids.filtered(lambda method: method.use_payment_terminal == 'easypay'))