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
    
    @api.depends('show_easypay_customer_screen', 'easypay_display_mode',
                 'easypay_welcome_message', 'easypay_thank_you_message',
                 'easypay_logo_image', 'easypay_logo_image_filename',
                 'easypay_slide_image_ids')
    def _compute_local_data_integrity(self):
        return super()._compute_local_data_integrity()

    @api.model
    def _load_pos_data_read(self, records, config):
        read_records = super()._load_pos_data_read(records, config)
        if read_records and config.show_easypay_customer_screen:
            record = read_records[0]
            record['_easypay_display_mode'] = config.easypay_display_mode
            record['_easypay_welcome_message'] = config._get_easypay_welcome_message()
            record['_easypay_thank_you_message'] = config._get_easypay_thank_you_message()
            if config.easypay_display_mode == 'slideshow' and config.easypay_slide_image_ids:
                record['_easypay_slide_image_ids'] = config._get_easypay_slide_images()
            if config.easypay_logo_image:
                record['_easypay_logo_image'] = config._get_easypay_logo_image()
        return read_records
