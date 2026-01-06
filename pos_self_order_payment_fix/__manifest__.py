# -*- coding: utf-8 -*-
{
    'name': 'POS Self Order - Payment Processing Fix',
    'version': '18.0.1.0.0',
    'category': 'Sales/Point Of Sale',
    'summary': 'Enable paid order processing from mobile apps via pos_self_order endpoint',
    'description': """
POS Self Order Payment Processing Fix
======================================

This module extends the standard pos_self_order controller to support paid orders 
sent from mobile applications while maintaining backward compatibility with the 
existing "Pay at Counter" workflow.

Key Features:
-------------
* Processes paid orders with payment validation
* Validates payment amounts match order totals using currency precision
* Maintains backward compatibility with draft orders (Pay at Counter)
* Supports free orders (zero amount orders)
* Works seamlessly with Kiosk/mobile apps sending payment data

How It Works:
-------------
The module inherits the PosSelfOrderController and overrides the process_order_args 
method to check for payment records. If payments are present and cover the order 
total, the order is marked as paid and processed. Otherwise, it remains as draft 
for the Pay at Counter workflow.

Payment Validation:
-------------------
* Checks if order has payment_ids records
* Sums payment amounts and compares with order total
* Uses currency rounding precision for accurate comparison
* Only marks order as paid if payments cover full amount

Compatibility:
--------------
* Odoo 18.0
* Works with pos_self_order module
* Compatible with Kiosk apps and other mobile integrations
    """,
    'author': 'Your Company',
    'website': 'https://www.yourcompany.com',
    'depends': ['pos_self_order'],
    'data': [],
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
}

