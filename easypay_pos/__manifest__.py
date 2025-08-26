{
    'name': "Easypay POS",
    'support': "support@easypay.sa",
    'license': "OPL-1",
    'summary': """
        Easypay
        """,
    'author': "Easypay",
    'website': "https://easypay.sa",
    'category': 'Point of Sale',
    'version': '16.2.4',
    
    'depends': ['point_of_sale'],
    'assets': {
            'point_of_sale.assets': [
            'easypay_pos/static/src/css/print.css',
            'easypay_pos/static/src/css/easyButton.css',
            'easypay_pos/static/src/js/models.js',
            'easypay_pos/static/src/js/payments.js',
            'easypay_pos/static/src/js/Chrome.js',
            'easypay_pos/static/src/js/Screens/PaymentScreen.js',
            'easypay_pos/static/src/js/Screens/TicketScreen.js',
            'easypay_pos/static/src/js/Screens/ReceiptScreen.js',
            'easypay_pos/static/src/js/Screens/ProductScreen.js',
            'easypay_pos/static/src/xml/**/*.xml',
                ],
    },
    'data': [
        # 'security/ir.model.access.csv',
        'views/payment_method_view.xml',
        'views/payment_views.xml',
        'views/pos_config_views.xml',
    ],
    'auto_install': False,
    'application': True,
    'images': ['images/main_screenshot.png'],

}