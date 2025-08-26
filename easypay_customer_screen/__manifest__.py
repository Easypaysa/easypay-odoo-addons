{
    'name': 'Easypay Customer Display Screen',
    'support': "support@easypay.sa",
    'license': "OPL-1",
    'author': "Easypay",
    'website': "https://easypay.sa",
    'category': 'Point of Sale',
    'version': '16.2',
    'depends': [
        'point_of_sale',
        'easypay_pos',
    ],
    'data': [
        'views/res_config_settings_views.xml'
    ],
    'auto_install': False,
    'application': False,
    'assets': {
        'point_of_sale.assets': [
            'easypay_customer_screen/static/src/js/easypay_customer_display.js',
            'easypay_customer_screen/static/src/js/EasypayControlButton.js',
            'easypay_customer_screen/static/src/js/ChromeExtension.js',
            'easypay_customer_screen/static/src/xml/EasypayControlButton.xml',
            'easypay_customer_screen/static/src/xml/ChromeExtension.xml',
            'easypay_customer_screen/static/src/overrides/screens/product_screen.js',
            'easypay_customer_screen/static/src/overrides/screens/receipt_screen.js',
        ]
    },
    'images': ['images/main_screenshot.png'],
}
