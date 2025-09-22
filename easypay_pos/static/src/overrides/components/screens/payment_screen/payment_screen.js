/** @odoo-module */

import {PaymentScreen} from "@point_of_sale/app/screens/payment_screen/payment_screen";
import {patch} from "@web/core/utils/patch";
import {onMounted} from "@odoo/owl";
import {useService} from "@web/core/utils/hooks";
import { ask } from "@point_of_sale/app/store/make_awaitable_dialog";
import {_t} from "@web/core/l10n/translation";
import { floatIsZero } from "@web/core/utils/numbers";
import {OrderReceipt} from "@point_of_sale/app/screens/receipt_screen/receipt/order_receipt";

patch(PaymentScreen.prototype, {
    setup() {
        super.setup(...arguments);

        this.printer = useService("printer");
        this.renderer = useService("renderer");
        var payment_lines = this.paymentLines;
        for (var i = 0; i < payment_lines.length; i++) {
            if (!payment_lines[i].is_done() && payment_lines[i].get_payment_status() == "pending")
                this.currentOrder.remove_paymentline(payment_lines[i]);
        }
    },

    onMounted() {
        const pendingPaymentLine = this.currentOrder.payment_ids.find(
            paymentLine => paymentLine.payment_method_id.use_payment_terminal === 'easypay' && (!paymentLine.is_done() && paymentLine.get_payment_status() !== 'pending')
        );
        if (pendingPaymentLine) {
            pendingPaymentLine.set_payment_status('force_done');
        } else {
            super.onMounted();
            this.autoEasypay();
        }
    },

    autoEasypay() {
        if (this.payment_methods_from_config.length == 1) {
            if (this.payment_methods_from_config[0].use_payment_terminal === 'easypay') {
                if (this.currentOrder.get_paymentlines().length > 0) {
                    this.sendPaymentRequest(this.currentOrder.get_paymentlines()[0])
                }
            }
        }
    },

    async getLastTransaction(line) {
        if (line.payment_method_id.use_payment_terminal !== 'easypay') {
            return;
        }

        this.pos.paymentTerminalInProgress = true;
        this.numberBuffer.capture();
        this.paymentLines.forEach(function (line) {
            line.can_be_reversed = false;
        });

        let isPaymentSuccessful = false;
        if (line.payment_method_id.payment_method_type === "qr_code") {
            const resp = await this.pos.showQR(line);
            isPaymentSuccessful = line.handle_payment_response(resp);
        } else {
            isPaymentSuccessful = await line.getLastTransaction();
        }

        this.pos.paymentTerminalInProgress = false;
        const config = this.pos.config;
        const currency = this.pos.currency;
        const currentOrder = line.pos_order_id;
        if (
            isPaymentSuccessful &&
            currentOrder.is_paid() &&
            floatIsZero(currentOrder.get_due(), currency.decimal_places) &&
            config.auto_validate_terminal_payment
        ) {
            this.validateOrder(false);
        }
    },

    async PrintLastResult() {
        var self = this;
        if (this.pos.is_DeviceName && this.pos.is_connected) {
            if (self.pos.socket && self.pos.socket.readyState === 1) {
                this.pos.socket.send(JSON.stringify({
                    "method": "PrintLastResult",
                }));
            }
        } else {
            var LastResultReceipt = this.pos.last_reuslt
            if (!LastResultReceipt) return;
            var printdiv = await fetch(LastResultReceipt);
            var content = await printdiv.text();
            var doc = document.getElementsByClassName("pos-receipt");
            var el = doc[0];
            doc[0].innerHTML = content
            var receiptString = doc[0].outerHTML;
            if (this.printer.is()) {
                const printResult = await this.printer.printHtml(el, {webPrintFallback: true});
                if (printResult.successful) {
                    return true;
                } else {
                    const confirmed = await ask(this.dialog, {
                        title: _t("Printing error"),
                        body: 'Do you want to print using the web printer?',
                    });
                    if (confirmed) {
                        return this.renderer.whenMounted({el, callback: window.print});
                    }
                    return false;
                }
            } else {
                return this.renderer.whenMounted({el, callback: window.print});
            }
            doc[0].innerHTML = ''
        }
    },

    get totalDueText() {
        return this.pos.format_currency(
            this.currentOrder.get_total_with_tax() + this.currentOrder.get_rounding_applied()
        );
    },

    async _CustomerDisplayReceipt() {
        var self = this;
        // console.log("deviceModel", self.pos.deviceModel);
        if (window.CustomerDisplay || (self.pos.is_DeviceName && self.pos.is_connected)) {
            if (self.pos.deviceModel === 'Z100') {
                const renderedReceipt = renderToString('easypay_pos.EasyCustomerDisplay', {
                    _receipt: {
                        lineCount: 2,
                        line1: "الرجاء تمرير البطاقة للدفع",
                        line2: self.totalDueText,
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
                    self.pos.socket.send(CustomerDisplayMessage);
                }
                return
            } else if (self.pos.deviceModel === 'I22T01') {
                const renderedReceipt = renderToString('easypay_pos.EasyCustomerDisplayimin', {
                    _receipt: {
                        lineCount: 2,
                        line1: "الرجاء تمرير البطاقة للدفع",
                        line2: self.totalDueText,
                    }
                });
                const receipt_image_64 = await self.htmlToImg(renderedReceipt);
                // console.log(receipt_image_64);
                var CustomerDisplayMessage = JSON.stringify({
                    'data': receipt_image_64,
                    'cutter': true,
                    "method": "CustomerDisplayMessage"
                });
                if (window.CustomerDisplay) {
                    CustomerDisplay.postMessage(CustomerDisplayMessage);
                } else {
                    self.pos.socket.send(CustomerDisplayMessage);
                }
                return

            }

        }
        return
    },


    htmlToImg(receipt) {
        $('.pos-receipt-print').html(receipt);
        if (this.pos.deviceModel === 'Z100') {
            this.receipt = $('.pos-receipt-print>.zcsdisplayimage');
        } else if (this.pos.deviceModel === 'I22T01') {
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
    },
});

