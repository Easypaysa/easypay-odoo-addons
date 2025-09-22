# -*- coding: utf-8 -*-
from odoo import fields, models


class PosPayment(models.Model):
    _inherit = 'pos.payment'

    receipt_url = fields.Char(string='Receipt URL', help='URL link to the payment receipt') 