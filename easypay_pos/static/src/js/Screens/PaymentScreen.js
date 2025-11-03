odoo.define('easypay_pos.PaymentScreen', function (require) {
    'use strict';
    const Registries = require('point_of_sale.Registries');
    const PaymentScreen = require('point_of_sale.PaymentScreen');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    var framework = require('web.framework');
    const {useListener} = require("@web/core/utils/hooks");
    const {Printer} = require('point_of_sale.Printer');
    const {renderToString} = require('@web/core/utils/render');

    const myPaymentScreen = (PaymentScreen) =>
        class extends PaymentScreen {


            setup() {
                super.setup();
                useListener('print-last-result', this._PrintLastResult);
                useListener('get-last-transaction', this._getLastTransaction);
                var payment_lines = this.currentOrder.get_paymentlines();
                for (var i = 0; i < payment_lines.length; i++) {
                    if (payment_lines[i].get_payment_status() !== "done")
                        this.currentOrder.remove_paymentline(payment_lines[i]);
                    }
            }

            async _PrintLastResult() {
                var LastResultReceipt = this.env.pos.last_reuslt
                if (!LastResultReceipt) return;
                var printdiv = await fetch(LastResultReceipt);
                var content = await printdiv.text();
                var doc = document.getElementsByClassName("pos-receipt");
                doc[0].innerHTML = content
                var receiptString = doc[0].outerHTML;
                if (this.env.proxy.printer) {
                    const printResult = await this.env.proxy.printer.print_receipt(receiptString);
                    if (printResult.successful) {
                        return true;
                    } else {
                        const {confirmed} = await this.showPopup('ConfirmPopup', {
                            title: printResult.message.title,
                            body: 'Do you want to print using the web printer?',
                        });
                        if (confirmed) {
                            // We want to call the _printWeb when the popup is fully gone
                            // from the screen which happens after the next animation frame.
                            await nextFrame();
                            return await this._printWeb();
                        }
                        return false;
                    }
                } else {
                    return await this._printWeb();
                }
                doc[0].innerHTML = ''
            
            }

            async _printWeb() {
                try {
                    window.print();
                    return true;
                } catch (err) {
                    await this.showPopup('ErrorPopup', {
                        title: this.env._t('Printing is not supported on some browsers'),
                        body: this.env._t(
                            'Printing is not supported on some browsers due to no default printing protocol ' +
                            'is available. It is possible to print your tickets by making use of an IoT Box.'
                        ),
                    });
                    return false;
                }
            }

            async _getLastTransaction({detail: line}) {
                this.paymentLines.forEach(function (line) {
                    line.can_be_reversed = false;
                });

                const payment_terminal = line.payment_method.payment_terminal;
                if (line.payment_method.use_payment_terminal !== 'easypay') {
                    return super._sendPaymentRequest({detail: line})
                }

                // await this._CustomerDisplayReceipt();

                line.set_payment_status('waitingCard');
                // framework.blockUI();
                if (line.amount < 0 && line.amount != 0) {
                    var isPaymentSuccessful = await payment_terminal.send_payment_reversal(line.cid);
                } else {
                    var isPaymentSuccessful = await payment_terminal.get_last_transaction_request(line.cid);
                }

                if (isPaymentSuccessful && line.get_payment_status() == 'done') {
                    this.env.pos.udid = ''
                    // line.can_be_reversed = payment_terminal.supports_reversals;
                    if (!window.PrintImage && this.env.pos.config.enable_auto_print_payment_transaction) {
                        await this._PrintLastResult();
                    }
                    if (this.env.pos.config.easy_auto_validate) {
                        this.validateOrder();
                    }
                } else if (isPaymentSuccessful && line.get_payment_status() !== 'done') {
                    var thiswait = true;
                    while (thiswait) {
                        if (['retry', 'done', 'cancel'].includes(line.get_payment_status())) thiswait = false;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    if (line.get_payment_status() == 'done') {
                        // line.can_be_reversed = payment_terminal.supports_reversals;
                    }
                } else {
                    line.set_payment_status('retry');
                }
                this.to_print = true;
                framework.unblockUI();
                this.render();
            }

            async _sendPaymentRequest({detail: line}) {
                // Other payment lines can not be reversed anymore
                this.paymentLines.forEach(function (line) {
                    line.can_be_reversed = false;
                });

                const payment_terminal = line.payment_method.payment_terminal;
                if (line.payment_method.use_payment_terminal !== 'easypay') {
                    return super._sendPaymentRequest({detail: line})
                }

                // await this._CustomerDisplayReceipt();

                line.set_payment_status('waitingCard');
                // framework.blockUI();
                if (line.amount < 0 && line.amount != 0) {
                    var isPaymentSuccessful = await payment_terminal.send_payment_reversal(line.cid);
                } else {
                    var isPaymentSuccessful = await payment_terminal.send_payment_request(line.cid);
                }

                if (isPaymentSuccessful && line.get_payment_status() == 'done') {
                    this.env.pos.udid = ''
                    // line.can_be_reversed = payment_terminal.supports_reversals;
                    if (!window.PrintImage && this.env.pos.config.enable_auto_print_payment_transaction) {
                        await this._PrintLastResult();
                    }
                    if (this.env.pos.config.easy_auto_validate) {
                        this.validateOrder();
                    }
                } else if (isPaymentSuccessful && line.get_payment_status() !== 'done') {
                    var thiswait = true;
                    while (thiswait) {
                        if (['retry', 'done', 'cancel'].includes(line.get_payment_status())) thiswait = false;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    if (line.get_payment_status() == 'done') {
                        // line.can_be_reversed = payment_terminal.supports_reversals;
                    }
                } else {
                    line.set_payment_status('retry');
                }
                this.to_print = true;
                framework.unblockUI();
                this.render();

            }

            async _sendPaymentReverse({detail: line}) {
                const payment_terminal = line.payment_method.payment_terminal;
                if (line.payment_method.use_payment_terminal !== 'easypay') {
                    return super._sendPaymentRequest({detail: line})
                }
                line.set_payment_status('waiting');
                framework.blockUI();
                const isReversalSuccessful = await payment_terminal.sendPaymentReverse({detail: line});
                if (isReversalSuccessful && line.get_payment_status() !== 'reversed') {
                    var thiswait = true;
                    while (thiswait) {
                        if (['retry', 'done', 'cancel'].includes(line.get_payment_status())) thiswait = false;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                framework.unblockUI();
                this.render();


                /*
                if (line.payment_method.use_payment_terminal === 'easypay' && this.env.pos.ECRTerminal && !this.env.pos.ECRTerminal.is_selected()) {
                    await this.env.pos.ECRTerminal.scan();
                }
                return super._sendPaymentReverse({ detail: line });
                */
            }

            deletePaymentLine(event) {
                var self = this;
                const {cid} = event.detail;
                const line = this.paymentLines.find((line) => line.cid === cid);
                const payment_terminal = line.payment_method.payment_terminal;
                if (line.payment_method.use_payment_terminal !== 'easypay') {
                    return super.deletePaymentLine(event)
                }

                // If a paymentline with a payment terminal linked to
                // it is removed, the terminal should get a cancel
                // request.
                if (['waiting', 'waitingCard', 'timeout'].includes(line.get_payment_status())) {
                    line.set_payment_status('retry');
                    self.currentOrder.remove_paymentline(line);
                    NumberBuffer.reset();
                    self.render();
                } else if (line.get_payment_status() !== 'waitingCancel') {
                    self.currentOrder.remove_paymentline(line);
                    NumberBuffer.reset();
                    self.render();
                }
            }

            async _sendPaymentCancel({detail: line}) {
                const payment_terminal = line.payment_method.payment_terminal;
                if (line.payment_method.use_payment_terminal !== 'easypay') {
                    return super._sendPaymentCancel({detail: line})
                }
                line.set_payment_status('waiting');

                if (['waiting', 'waitingCard', 'timeout'].includes(line.get_payment_status())) {
                    line.set_payment_status('retry');
                    NumberBuffer.reset();
                    this.render();
                } else {
                    super._sendPaymentCancel({detail: line});
                }
            }

            get totalDueText() {
                return this.env.pos.format_currency(
                    this.currentOrder.get_total_with_tax() + this.currentOrder.get_rounding_applied()
                );
            }

            async _CustomerDisplayReceipt() {
                var self = this;
                // console.log("deviceModel", self.env.pos.deviceModel);
                if (window.CustomerDisplay || self.env.pos.is_DeviceName && self.env.pos.is_connected) {
                    if (self.env.pos.deviceModel === 'Z100') {
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
                            self.env.pos.socket.send(CustomerDisplayMessage);
                        }
                        return
                    } else if (self.env.pos.deviceModel === 'I22T01') {
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
                            self.env.pos.socket.send(CustomerDisplayMessage);
                        }
                        return

                    }

                }
                return
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
    Registries.Component.extend(PaymentScreen, myPaymentScreen);
    return PaymentScreen;
});