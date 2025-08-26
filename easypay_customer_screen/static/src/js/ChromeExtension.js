odoo.define('easypay_customer_screen.ChromeExtension', function(require) {
    'use strict';

    const Chrome = require('point_of_sale.Chrome');
    const Registries = require('point_of_sale.Registries');

    const EasypayChrome = (Chrome) => 
        class extends Chrome {
            get easypayControlButtonIsShown() {
                return this.env.pos.config.show_easypay_customer_screen;
            }
        };

    Registries.Component.extend(Chrome, EasypayChrome);

    return Chrome;
});
