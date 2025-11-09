/** @odoo-module **/

import { memoize } from "@web/core/utils/functions";
import { PosStore } from "@point_of_sale/app/store/pos_store";
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
patch(PosStore.prototype, {

    async loadEasypayDisplayData() {

        var data = []
        const orderlines = this.get_order().get_orderlines();
         const productImages = Object.fromEntries(
            await Promise.all(
                orderlines.map(async ({ product_id }) => [
                    product_id.id,
                    await getProductImage(product_id.id, product_id.writeDate),
                ])
            )
        );
        orderlines.forEach((orderline)=>{
            // Handle orderline ID - only parse if it's a string with underscore format
            let orderlineId;
            if (typeof orderline.id === 'string' && orderline.id.includes('_')) {
                orderlineId = parseInt(orderline.id.split('_').pop());
                data.push({
                    id: orderlineId,
                    product_name: orderline.get_full_product_name(),
                    quantity: orderline.get_quantity(),
                    unit_price: orderline.get_unit_display_price(),
                    price: orderline.get_price_with_tax(),
                    // image: orderline.product_id.getTemplateImageUrl()
                    product_image:productImages[orderline.product_id.id].split(',')[1]
                 })
            } else {
                // Skip numeric IDs or use a default/fallback value
                data = null;
                return;
            }
            
            

        });

        if (data !== null) {
        var outdata = {
            method: 'UpdateAllOrderlines',
            data: data
            }
            return outdata;
        }
        return null;
    },

    async updateWs({ closeUI = false } = {}) {
        var self = this;
        if (!self.config.show_easypay_customer_screen) {
            return;
        }
        if (window.updateCustomerDisplay) {
            try {
                var data = await self.loadEasypayDisplayData();
                if (data) {
                    updateCustomerDisplay.postMessage(JSON.stringify(data))
                }
            } catch (e) {
                console.log(e);
            }
        }else if (!self.socket || [WebSocket.CLOSED, WebSocket.CLOSING].includes(self.socket.readyState)) {
            return;
        }
        try {
            if (self.socket) {
                var data = await self.loadEasypayDisplayData();
                if (data) {
                self.socket.send(JSON.stringify(data));
                }
            }

        } catch (e) {
            console.log(e);
        }
    },
});