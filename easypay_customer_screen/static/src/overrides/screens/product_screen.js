odoo.define('easypay_customer_screen.ProductScreen', function(require) {
    'use strict';

    const ProductScreen = require('point_of_sale.ProductScreen');
    const Registries = require('point_of_sale.Registries');

    const EasypayProductScreen = (ProductScreen) => 
        class extends ProductScreen {
            setup() {
                super.setup();
                // Send hideThankYouScreen command when product screen is mounted
                this.sendHideThankYouScreenCommand();
            }

            sendHideThankYouScreenCommand() {
                const pos = this.env.pos;
                if (!pos.config.show_easypay_customer_screen) {
                    return;
                }

                try {
                    // First send hideThankYouScreen command
                    const hideCommand = {
                        method: "hideThankYouScreen"
                    };

                    if (window.updateCustomerDisplay) {
                        window.updateCustomerDisplay.postMessage(JSON.stringify(hideCommand));
                    } else if (pos.socket && pos.socket.readyState === WebSocket.OPEN) {
                        pos.socket.send(JSON.stringify(hideCommand));
                    }

                    // Then send newOrder command
                    // const newOrderCommand = {
                    //     method: "newOrder"
                    // };

                    // if (window.updateCustomerDisplay) {
                    //     window.updateCustomerDisplay.postMessage(JSON.stringify(newOrderCommand));
                    // } else if (pos.socket && pos.socket.readyState === WebSocket.OPEN) {
                    //     pos.socket.send(JSON.stringify(newOrderCommand));
                    // }

                } catch (e) {
                    console.error("Error sending hideThankYouScreen and newOrder commands:", e);
                }
            }
        };

    Registries.Component.extend(ProductScreen, EasypayProductScreen);

    return ProductScreen;
});
