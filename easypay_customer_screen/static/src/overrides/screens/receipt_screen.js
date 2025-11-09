/** @odoo-module **/

import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { patch } from "@web/core/utils/patch";

patch(ReceiptScreen.prototype, {
    setup() {
        super.setup();
        // Send showThankYouScreen command when receipt screen is mounted
        this.sendThankYouScreenCommand();
    },

    sendThankYouScreenCommand() {
        const pos = this.pos;
        if (!pos.config.show_easypay_customer_screen) {
            return;
        }

        try {
            const addCommand = {
                method: "showThankYouScreen",
                message: pos.config._easypay_thank_you_message || "Thank you for your purchase!"
            };

            if (window.updateCustomerDisplay) {
                updateCustomerDisplay.postMessage(JSON.stringify(addCommand));
            } else if (pos.socket && ![WebSocket.CLOSED, WebSocket.CLOSING].includes(pos.socket.readyState)) {
                pos.socket.send(JSON.stringify(addCommand));
            }
        } catch (e) {
            console.error("Error sending showThankYouScreen command:", e);
        }
    }
});
