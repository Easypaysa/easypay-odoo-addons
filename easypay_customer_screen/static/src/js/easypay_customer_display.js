odoo.define('easypay_customer_screen.EasypayCustomerDisplay', function (require) {
"use strict";

const { PosGlobalState } = require('point_of_sale.models');
const Registries = require('point_of_sale.Registries');

const EasypayPosGlobalState = (PosGlobalState) => class EasypayPosGlobalState extends PosGlobalState {
    constructor(obj) {
        super(obj);
        // Initialize WebSocket connection for Easypay
        this.easypay_socket = null;
        this.easypay_init_attempted = false;
    }

    //@override
    async after_load_server_data() {
        await super.after_load_server_data(...arguments);
        if (this.config.show_easypay_customer_screen) {
            this._init_easypay_display();
        }
    }

    _init_easypay_display() {
        console.log('Initializing Easypay customer display...');
        // This will be called when POS is ready and customer display is enabled
        this.easypay_init_attempted = true;
    }

    loadEasypayDisplayData() {
        const self = this;
        const order = this.get_order();
        
        if (!order) {
            return Promise.resolve(null);
        }

        const orderlines = order.get_orderlines();
        
        // Get product images using Promise.all
        const imagePromises = [];
        const productImagesMap = new Map();
        
        orderlines.forEach((orderline) => {
            const product = orderline.product;
            if (!productImagesMap.has(product.id)) {
                productImagesMap.set(product.id, null);
                imagePromises.push(
                    this._getProductImage(product.id, product.__last_update)
                        .then(image => ({ productId: product.id, image }))
                        .catch(e => {
                            console.warn('Could not load image for product', product.id, e);
                            return { productId: product.id, image: null };
                        })
                );
            }
        });

        return Promise.all(imagePromises).then(imageResults => {
            // Build product images map
            const productImages = {};
            imageResults.forEach(result => {
                productImages[result.productId] = result.image;
            });

            // Build order data
            const data = [];
            orderlines.forEach((orderline) => {
                // Handle orderline ID - only parse if it's a string with underscore format
                let orderlineId;
                if (typeof orderline.id === 'string' && orderline.id.includes('_')) {
                    orderlineId = parseInt(orderline.id.split('_').pop());
                } else if (typeof orderline.id === 'number') {
                    orderlineId = orderline.id;
                } else {
                    // Skip invalid IDs
                    return;
                }

                const productImage = productImages[orderline.product.id];
                data.push({
                    id: orderlineId,
                    product_name: orderline.get_full_product_name(),
                    quantity: orderline.get_quantity(),
                    unit_price: orderline.get_unit_display_price(),
                    price: orderline.get_price_with_tax(),
                    product_image: productImage ? productImage.split(',')[1] : null
                });
            });

            // if (data.length > 0) {
                return {
                    method: 'UpdateAllOrderlines',
                    data: data
                };
            // }
            return null;
        });
    }

    _getProductImage(productId, writeDate) {
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
    }

    updateEasypayDisplay() {
        const self = this;
        
        if (!self.config.show_easypay_customer_screen) {
            return Promise.resolve();
        }

        return this.loadEasypayDisplayData().then(data => {
            if (!data) {
                return;
            }

            // Try postMessage method first (for embedded displays)
            if (window.updateCustomerDisplay) {
                try {
                    window.updateCustomerDisplay.postMessage(JSON.stringify(data));
                    return;
                } catch (e) {
                    console.log('Error sending via postMessage:', e);
                }
            }

            // Try WebSocket method (for external displays)
            if (self.socket && self.socket.readyState === WebSocket.OPEN) {
                try {
                    self.socket.send(JSON.stringify(data));
                } catch (e) {
                    console.log('Error sending via WebSocket:', e);
                }
            }
        }).catch(e => {
            console.log('Error updating Easypay display:', e);
        });
    }

    //@override
    send_current_order_to_customer_facing_display() {
        // Call the original method first
        super.send_current_order_to_customer_facing_display(...arguments);
        
        // Then update Easypay display
        this.updateEasypayDisplay();
    }
}

Registries.Model.extend(PosGlobalState, EasypayPosGlobalState);

return { EasypayPosGlobalState };
});
