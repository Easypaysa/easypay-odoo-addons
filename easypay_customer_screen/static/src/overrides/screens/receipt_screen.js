odoo.define('easypay_customer_screen.ReceiptScreen', function(require) {
    'use strict';

    const ReceiptScreen = require('point_of_sale.ReceiptScreen');
    const Registries = require('point_of_sale.Registries');

    const EasypayReceiptScreen = (ReceiptScreen) => 
        class extends ReceiptScreen {
            setup() {
                super.setup();
                // Send showThankYouScreen command when receipt screen is mounted
                this.sendThankYouScreenCommand();
            }

            sendThankYouScreenCommand() {
                const pos = this.env.pos;
                if (!pos.config.show_easypay_customer_screen) {
                    return;
                }

                try {
                    const addCommand = {
                        method: "showThankYouScreen",
                        message: pos.config.easypay_thank_you_message || "Thank you for your purchase!"
                    };

                    if (window.updateCustomerDisplay) {
                        window.updateCustomerDisplay.postMessage(JSON.stringify(addCommand));
                    } else if (pos.socket && pos.socket.readyState === WebSocket.OPEN) {
                        pos.socket.send(JSON.stringify(addCommand));
                    }
                } catch (e) {
                    console.error("Error sending showThankYouScreen command:", e);
                }
            }
        };

    Registries.Component.extend(ReceiptScreen, EasypayReceiptScreen);

    return ReceiptScreen;
});
