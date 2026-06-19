# -*- coding: utf-8 -*-
from odoo import api, fields, models


class EasypayCardScheme(models.Model):
    _name = 'easypay.card.scheme'
    _description = 'EasyPay Card Scheme'
    _inherit = ['pos.load.mixin']
    _order = 'code'

    def _get_default_color(self):
        return self.env['easypay.card.scheme'].search_count([]) % 12

    code = fields.Char(string='Code', required=True, help='Scheme ID (e.g., P1, VC)')
    name = fields.Char(string='Name', required=True, translate=True)
    color = fields.Integer(string='Color', default=_get_default_color)

    _sql_constraints = [
        ('code_unique', 'UNIQUE(code)', 'Card scheme code must be unique!')
    ]

    @api.model
    def _load_pos_data_domain(self, data, config):
        return []

    @api.model
    def _load_pos_data_fields(self, config):
        return ['id', 'code', 'name']

