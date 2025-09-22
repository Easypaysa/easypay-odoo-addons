# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'POS Easypay tap & pay',
    'version': '18.5.1.0.0',
    'category': 'Sales/Point of Sale',
    'sequence': 6,
    'summary': 'Integrate your POS with Easypay Soft POS',
    'description': """
Allow Easypay POS payments
==============================

This module allows customers to pay for their orders with debit and credit
cards. It allows the
following:

* Fast payment by just swiping/scanning a credit/debit card while on the payment screen
* Supported cards: Visa, MasterCard.
    """,
    'data': [
        'security/ir.model.access.csv',
        'views/pos_payment_method_views.xml',
        'views/pos_config_views.xml',
        'views/reconciliation.xml',
        'views/pos_session_views.xml',
        'views/pos_payment_views.xml',
    ],
    'depends': ['point_of_sale'],
    'installable': True,
    'assets': {
        'point_of_sale._assets_pos': [
            'easypay_pos/static/**/*',
        ],
    },
    'license': "OPL-1",
    'price': 269,
    'currency': "USD",
}
