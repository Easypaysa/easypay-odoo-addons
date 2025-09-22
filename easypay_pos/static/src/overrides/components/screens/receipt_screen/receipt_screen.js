/** @odoo-module **/

import {ReceiptScreen} from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import {patch} from "@web/core/utils/patch";
import {OrderReceipt} from "@point_of_sale/app/screens/receipt_screen/receipt/order_receipt";
import {useService} from "@web/core/utils/hooks";
import {renderToString} from "@web/core/utils/render";
import { useErrorHandlers, useTrackedAsync } from "@point_of_sale/app/utils/hooks";

import {renderToElement} from "@web/core/utils/render";
import {htmlToCanvas} from "@point_of_sale/app/printer/render_service";
import { useRef, useState, Component, onMounted } from "@odoo/owl";
import { toCanvas } from "@point_of_sale/app/utils/html-to-image";


patch(ReceiptScreen.prototype, {

    setup() {
        super.setup(...arguments);
        this.CustomerDisplayMessage();
        this.renderer = useService("renderer");
        // this.doFullPrint = useTrackedAsync(() => this.printReceipt());
        // this.orderEasyReceipt = useRef('order-receipt');
        
    },

    get_is_openCashDrawer() {
        return this.currentOrder.is_paid_with_cash() || this.currentOrder.get_change();
    },

    // async printReceipt() {
    //     // if (typeof AndroidEasypayGateway !== 'undefined' || window.PrintImage || (this.pos.is_DeviceName && this.pos.is_connected && this.pos.config.print_order_receipt)) {
    //         // const ticketImage = await this.generateTicketImage();
    //         const image_64 = await this.htmlToImg(this.orderEasyReceipt.el.innerHTML);
    //         if (window.PrintImage) {
    //             if (window.EasyLoading) {
    //                 EasyLoading.postMessage("");
    //             }
    //             if (this.get_is_openCashDrawer) {
    //                 if (window.OpenDrawer) {
    //                     var message = JSON.stringify({"method": "OpenDrawer"});
    //                     OpenDrawer.postMessage(message);
    //                 }
    //             }
    //             var message = JSON.stringify({'data': image_64, 'cutter': true, "method": "PrintImage"});
    //             await PrintImage.postMessage(message);
    //         } else if (typeof AndroidEasypayGateway !== 'undefined') {
    //             var message = JSON.stringify({'data': image_64, 'cutter': true, "method": "PrintImage"});
    //             AndroidEasypayGateway.PrintImage(message);
    //         } else {
    //             var message = JSON.stringify({'data': image_64, 'cutter': true, "method": "PrintImage"});
    //             this.pos.socket.send(message);
    //         }
    //     // } else {
    //     //     return this.pos.printReceipt();
    //     // }
    // },

    async CustomerDisplayMessage() {
        var self = this;
        if (window.CustomerDisplay || (self.pos.is_DeviceName && self.pos.is_connected)) {
            if (self.pos.deviceModel === 'Z100') {
                const renderedReceipt = renderToElement('easypay_pos.EasyCustomerDisplay', {
                    _receipt: {
                        lineCount: 1,
                        line1: "شكرا لزيارتك",
                        line2: '',
                    }
                });
                const receipt_image_64 = await self.getReceiptImage(renderedReceipt);
                var CustomerDisplayMessage = JSON.stringify({
                    'data': receipt_image_64, 'cutter': true,
                    "method": "CustomerDisplayMessage"
                });
                if (window.CustomerDisplay) {
                    CustomerDisplay.postMessage(CustomerDisplayMessage);
                } else {
                    self.pos.socket.send(CustomerDisplayMessage);
                }
            } else if (self.pos.deviceModel === 'I22T01') {
                const renderedReceipt = renderToElement('easypay_pos.EasyCustomerDisplayimin', {
                    _receipt: {
                        lineCount: 1,
                        line1: "شكرا لزيارتك",
                        line2: '',
                    }
                });
                const receipt_image_64 = await self.getReceiptImage(renderedReceipt);
                // console.log(receipt_image_64);
                var CustomerDisplayMessage = JSON.stringify({
                    'data': receipt_image_64, 'cutter': true,
                    "method": "CustomerDisplayMessage"
                });
                if (window.CustomerDisplay) {
                    CustomerDisplay.postMessage(CustomerDisplayMessage);
                } else {
                    self.pos.socket.send(CustomerDisplayMessage);
                }
            }

        }

    },

    async getReceiptImage(receipt) {
        this.receiptQueue = [];
        if (receipt) {
            this.receiptQueue.push(receipt);
        }
        let image, printResult;
        while (this.receiptQueue.length > 0) {
            receipt = this.receiptQueue.shift();
            image = this.processCanvas(
                await htmlToCanvas(receipt, {addClass: "pos-receipt-print"})
            );
        }
        return image;
    },

    processCanvas(canvas) {
        return canvas.toDataURL("image/jpeg").replace("data:image/jpeg;base64,", "");
    },

});


