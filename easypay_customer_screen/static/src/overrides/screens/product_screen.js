/** @odoo-module **/

import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { patch } from "@web/core/utils/patch";

patch(ProductScreen.prototype, {
    setup() {
        super.setup();
        // Send hideThankYouScreen command when product screen is mounted
        this.sendHideThankYouScreenCommand();
    },

    sendHideThankYouScreenCommand() {
        const pos = this.pos;
        if (!pos.config.show_easypay_customer_screen) {
            return;
        }

        try {
            const addCommand = {
                method: "hideThankYouScreen"
            };

            if (window.updateCustomerDisplay) {
                updateCustomerDisplay.postMessage(JSON.stringify(addCommand));
            } else if (pos.socket && ![WebSocket.CLOSED, WebSocket.CLOSING].includes(pos.socket.readyState)) {
                pos.socket.send(JSON.stringify(addCommand));
            }
        } catch (e) {
            console.error("Error sending hideThankYouScreen command:", e);
        }
    }
});
