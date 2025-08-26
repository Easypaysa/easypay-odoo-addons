# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class PosConfig(models.Model):
    _inherit = 'pos.config'

    show_easypay_customer_screen = fields.Boolean(
        string="Show Customer Display in Easypay",
        help="Enable Easypay customer display screen integration"
    )
    easypay_slide_image_ids = fields.Many2many(
        'ir.attachment',
        relation='pos_config_easypay_slide_image_rel',
        column1='config_id',
        column2='attachment_id',
        string="Slide Images",
        help="Images to display on the customer screen as slideshow",
    )
    easypay_logo_image = fields.Binary(
        string="Logo Image",
        help="Logo image to display on the customer screen",
    )
    easypay_logo_image_filename = fields.Char(
        string="Logo Image Filename"
    )
    easypay_display_mode = fields.Selection([
        ('slideshow', 'Slideshow Images'),
        ('welcome_message', 'Welcome Message'),
    ], string="Display Mode", default='welcome_message', 
       help="Choose what to display on the customer screen")
    easypay_welcome_message = fields.Text(
        string="Welcome Message",
        default="Welcome...",
        help="Message to display on the customer screen when welcome message mode is selected"
    )
    easypay_thank_you_message = fields.Text(
        string="Thank You Message",
        default="Thank you for your purchase!",
        help="Message to display on the customer screen when showing thank you screen"
    )
