odoo.define('easypay_pos.ProductScreen', function (require) {
    'use strict';
    const ProductScreen = require('point_of_sale.ProductScreen');
    const Registries = require('point_of_sale.Registries');
    const {renderToString} = require('@web/core/utils/render');

    const EasypayCustomProductScreen = (ProductScreen) =>

        class extends ProductScreen {

            onMounted() {
                this.CustomerDisplayMessage();
                return super.onMounted()
            }

            async CustomerDisplayMessage() {
                var self = this;
                self.env.pos.paymentDone = false
                if (window.CustomerDisplay || self.env.pos.is_DeviceName && self.env.pos.is_connected) {
                    if (self.env.pos.deviceModel === 'Z100') {
                        const renderedReceipt = renderToString('easypay_pos.EasyCustomerDisplay', {
                            _receipt: {
                                lineCount: 1,
                                line1: "مرحبا",
                                line2: '',
                            }
                        });
                        const receipt_image_64 = await this.htmlToImg(renderedReceipt);
                        var CustomerDisplayMessage = JSON.stringify({
                            'data': receipt_image_64, 'cutter': true,
                            "method": "CustomerDisplayMessage"
                        });
                        if (window.CustomerDisplay) {
                            CustomerDisplay.postMessage(CustomerDisplayMessage);
                        } else {
                            self.env.pos.socket.send(CustomerDisplayMessage);
                        }
                    } else if (self.env.pos.deviceModel === 'I22T01') {
                        const renderedReceipt = renderToString('easypay_pos.EasyCustomerDisplayimin', {
                            _receipt: {
                                lineCount: 1,
                                line1: "مرحبا",
                                line2: '',
                            }
                        });
                        const receipt_image_64 = await self.htmlToImg(renderedReceipt);
                        // console.log(receipt_image_64);
                        var CustomerDisplayMessage = JSON.stringify({
                            'data': receipt_image_64, 'cutter': true,
                            "method": "CustomerDisplayMessage"
                        });
                        if (window.CustomerDisplay) {
                            CustomerDisplay.postMessage(CustomerDisplayMessage);
                        } else {
                            self.env.pos.socket.send(CustomerDisplayMessage);
                        }
                    }

                }

            }

            htmlToImg(receipt) {
                $('.pos-receipt-print').html(receipt);
                if (this.env.pos.deviceModel === 'Z100') {
                    this.receipt = $('.pos-receipt-print>.zcsdisplayimage');
                } else if (this.env.pos.deviceModel === 'I22T01') {
                    this.receipt = $('.pos-receipt-print>.imindisplayimage');
                }
                // Odoo RTL support automatically flip left into right but html2canvas
                // won't work as expected if the receipt is aligned to the right of the
                // screen so we need to flip it back.
                this.receipt.parent().css({left: 0, right: 'auto'});
                return html2canvas(this.receipt[0], {
                    height: Math.ceil(this.receipt.height()),
                    width: Math.ceil(this.receipt.width()),
                    scale: 1,
                }).then(canvas => {
                    $('.pos-receipt-print').empty();
                    return canvas.toDataURL('image/jpeg').replace('data:image/jpeg;base64,', '');
                });
            }

        };

    Registries.Component.extend(ProductScreen, EasypayCustomProductScreen);

    return ProductScreen;
});
