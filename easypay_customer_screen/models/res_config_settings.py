# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # pos.config fields - following Odoo 16 standard pattern

    pos_show_easypay_customer_screen = fields.Boolean(
        related='pos_config_id.show_easypay_customer_screen',
        readonly=False,
        string="Show Easypay Customer Display"
    )
    pos_easypay_display_mode = fields.Selection(
        related='pos_config_id.easypay_display_mode',
        readonly=False,
        string="Display Mode"
    )
    pos_easypay_welcome_message = fields.Text(
        related='pos_config_id.easypay_welcome_message',
        readonly=False,
        string="Welcome Message"
    )
    pos_easypay_thank_you_message = fields.Text(
        related='pos_config_id.easypay_thank_you_message',
        readonly=False,
        string="Thank You Message"
    )
    pos_easypay_slide_image_ids = fields.Many2many(
        related='pos_config_id.easypay_slide_image_ids',
        readonly=False,
        string="Slide Images"
    )
    pos_easypay_logo_image = fields.Binary(
        related='pos_config_id.easypay_logo_image',
        readonly=False,
        string="Logo Image"
    )
    pos_easypay_logo_image_filename = fields.Char(
        related='pos_config_id.easypay_logo_image_filename',
        readonly=False,
        string="Logo Image Filename"
    )