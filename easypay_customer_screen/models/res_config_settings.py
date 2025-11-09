from odoo import models, fields, api


class Config(models.TransientModel):
    _inherit = 'res.config.settings'

    pos_show_easypay_customer_screen = fields.Boolean(
        "Show Customer Display in Easypay", related="pos_config_id.show_easypay_customer_screen", readonly=False)
    pos_easypay_slide_image_ids = fields.Many2many(
        'ir.attachment', string="Slide Images",
        related="pos_config_id.easypay_slide_image_ids", readonly=False)
    pos_easypay_logo_image = fields.Binary(
        string="Logo Image",
        related="pos_config_id.easypay_logo_image", readonly=False)
    pos_easypay_logo_image_filename = fields.Char(
        string="Logo Image Filename",
        related="pos_config_id.easypay_logo_image_filename", readonly=False)
    pos_easypay_display_mode = fields.Selection(
        related="pos_config_id.easypay_display_mode", readonly=False)
    pos_easypay_welcome_message = fields.Text(
        string="Welcome Message", 
        related="pos_config_id.easypay_welcome_message", readonly=False)
    pos_easypay_thank_you_message = fields.Text(
        string="Thank You Message",
        related="pos_config_id.easypay_thank_you_message", readonly=False)
