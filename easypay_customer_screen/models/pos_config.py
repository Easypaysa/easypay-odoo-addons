from odoo import models, fields, api


class PosConfig(models.Model):
    _inherit = 'pos.config'

    show_easypay_customer_screen = fields.Boolean("Show Customer Display in Easypay")
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
    
    def _get_easypay_slide_images(self):
        """Get encoded slide images for the POS customer screen"""
        self.ensure_one()
        encoded_images = []
        for image in self.easypay_slide_image_ids:
            encoded_images.append({
                'id': image.id,
                'data': image.sudo().datas.decode('utf-8'),
            })
        return encoded_images
    
    def _get_easypay_logo_image(self):
        """Get encoded logo image for the POS customer screen"""
        self.ensure_one()
        if self.easypay_logo_image:
            return {
                'data': self.easypay_logo_image.decode('utf-8'),
                'filename': self.easypay_logo_image_filename or 'logo.png',
            }
        return None
    
    def _get_easypay_welcome_message(self):
        """Get welcome message for the POS customer screen"""
        self.ensure_one()
        return self.easypay_welcome_message or "Welcome..."
    
    def _get_easypay_thank_you_message(self):
        """Get thank you message for the POS customer screen"""
        self.ensure_one()
        return self.easypay_thank_you_message or "Thank you for your purchase!"
    
    def _load_pos_data(self, data):
        result = super()._load_pos_data(data)
        if result['data'] and result['data'][0]['show_easypay_customer_screen']:
            config_id = result['data'][0]['id']
            config = self.browse(config_id)
            # Load display mode, welcome message, and thank you message
            result['data'][0]['_easypay_display_mode'] = config.easypay_display_mode
            result['data'][0]['_easypay_welcome_message'] = config._get_easypay_welcome_message()
            result['data'][0]['_easypay_thank_you_message'] = config._get_easypay_thank_you_message()
            # Load slideshow images if display mode is slideshow
            if config.easypay_display_mode == 'slideshow' and config.easypay_slide_image_ids:
                result['data'][0]['_easypay_slide_image_ids'] = config._get_easypay_slide_images()
            # Load logo if configured
            if config.easypay_logo_image:
                result['data'][0]['_easypay_logo_image'] = config._get_easypay_logo_image()
        return result
