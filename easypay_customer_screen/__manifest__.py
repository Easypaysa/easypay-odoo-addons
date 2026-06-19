{
    'name': 'Easypay customer Display Screen',
    'support': "support@easyerps.com",
    'license': "OPL-1",
    'author': "EasyERPS",
    'website': "https://easyerps.com",
    'category': 'Point of Sale',
    'version': '19.0.1.0.0',
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
        'point_of_sale._assets_pos': [
            'easypay_customer_screen/static/**/*',
        ]
    },
    'images': ['images/main_screenshot.png'],
}
