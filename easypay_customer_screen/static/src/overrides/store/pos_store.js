/** @odoo-module **/

import { memoize } from "@web/core/utils/functions";
import { PosStore } from "@point_of_sale/app/services/pos_store";
import { patch } from "@web/core/utils/patch";
//import { useService } from "@web/core/utils/hooks";
//import { useState } from "@odoo/owl";
const getProductImage = memoize(function getProductImage(productId, writeDate) {
    return new Promise(function (resolve, reject) {
        const img = new Image();
        img.addEventListener("load", () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.height = img.height;
            canvas.width = img.width;
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg"));
        });
        img.addEventListener("error", reject);
        img.src = `/web/image?model=product.product&field=image_128&id=${productId}&unique=${writeDate}`;
    });
});

// In Odoo 19, an unsaved order line's `id` is its uuid string (see related_models).
// The external display app expects a numeric id, so derive a stable positive
// integer: use the DB id when the line is already saved, otherwise hash the uuid.
function getOrderlineNumericId(orderline) {
    if (typeof orderline.id === "number") {
        return orderline.id;
    }
    const key = orderline.uuid || String(orderline.id);
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (Math.imul(hash, 31) + key.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

patch(PosStore.prototype, {

    async loadEasypayDisplayData() {

        var data = []
        const orderlines = this.getOrder().getOrderlines();
         const productImages = Object.fromEntries(
            await Promise.all(
                orderlines.map(async ({ product_id }) => [
                    product_id.id,
                    await getProductImage(product_id.id, product_id.write_date),
                ])
            )
        );
        orderlines.forEach((orderline)=>{
            data.push({
                id: getOrderlineNumericId(orderline),
                uuid: orderline.uuid,
                product_name: orderline.getFullProductName(),
                quantity: orderline.getQuantity(),
                unit_price: orderline.displayPriceUnit,
                price: orderline.priceIncl,
                product_image: productImages[orderline.product_id.id].split(',')[1]
            });
        });

        var outdata = {
            method: 'UpdateAllOrderlines',
            data: data
        }
        return outdata;
    },

    async updateWs({ closeUI = false } = {}) {
        var self = this;
        if (!self.config.show_easypay_customer_screen) {
            return;
        }
        try {
            // Load the payload once, then send it through a single channel:
            // the Android WebView bridge when available, otherwise the WebSocket.
            var data = await self.loadEasypayDisplayData();
            if (!data) {
                return;
            }
            var payload = JSON.stringify(data);
            // Core fires sendOrderToCustomerDisplay several times per product add
            // (its reactive effect settles across async ticks). Skip resending an
            // identical payload so the display only receives one update per change.
            if (payload === self._lastEasypayPayload) {
                return;
            }
            self._lastEasypayPayload = payload;
            if (window.updateCustomerDisplay) {
                updateCustomerDisplay.postMessage(payload);
            } else if (self.socket && ![WebSocket.CLOSED, WebSocket.CLOSING].includes(self.socket.readyState)) {
                self.socket.send(payload);
            }
        } catch (e) {
            console.log(e);
        }
    },
});