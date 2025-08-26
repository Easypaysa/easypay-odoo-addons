odoo.define('easypay_pos.payment', function (require) {
    "use strict";
    const core = require('web.core');
    const {Gui} = require('point_of_sale.Gui');
    const PaymentInterface = require('point_of_sale.PaymentInterface');
    const {renderToString} = require('@web/core/utils/render');
    var framework = require('web.framework');
    var _t = core._t;
    // const {promise, externalResolve, externalReject} = createPromise();
    //
    // function createPromise() {
    //     let externalResolve, externalReject;
    //
    //     const promise = new Promise((resolve, reject) => {
    //         externalResolve = resolve;
    //         externalReject = reject;
    //     });
    //
    //     return {promise, externalResolve, externalReject};
    // }

    var callbackMap = {};
    var callbackId = 0;

    window.resolveCallback = function (callbackId, response) {
        // console.log("resolveCallback", response.toString())
        if (callbackMap[callbackId]) {
            callbackMap[callbackId](response);
            delete callbackMap[callbackId];
        }
    }

    function resolvePromise() {
        resolveExternal('Promise resolved successfully!');
    }

// Function that rejects the promise
    function rejectPromise() {
        rejectExternal(new Error('There was an error with the promise.'));
    }

    let resolveExternal, rejectExternal;
    let isSettled = false;

    function createControlledPromise() {
        isSettled = false;
        const promise = new Promise((resolve, reject) => {
            resolveExternal = (value) => {
                if (!isSettled) {
                    isSettled = true;
                    resolve(value);
                }
            };
            rejectExternal = (reason) => {
                if (!isSettled) {
                    isSettled = true;
                    reject(reason);
                }
            };
        });
        return promise;
    }

    var PaymentEasypay = PaymentInterface.extend({

        /**
         * @override
         */
        send_payment_cancel: async function (order, cid) {
            this._super.apply(this, arguments);

            if (await this.connect()) {
                return this._reverse();
            }

            return Promise.reject();
        },

        fromEasyPay: function (transaction) {
            this.pos.paymentProcessing = false
            this._CustomerDisplayReceipt();
            const order = this.pos.get_order();
            const line = order.selected_paymentline;
            if (transaction === "false") {
                line.set_payment_status('retry');
                rejectPromise();
            }
            this.pos.paymentDone = true
            var text = JSON.stringify(transaction)

            var result = JSON.parse(JSON.parse(text));
            this.pos.last_reuslt = result.qr_code
            // var result = JSON.parse(text);
            // var result = Object.values(trans)
            // // result.push(trans)
            //
            // console.log('result',result)
            // if (result.status && parseInt(result.status) == 200) {

            line.set_payment_status('done');
            this._decode_response(result);
            resolvePromise()
            // }

        },
        _show_error: function (msg, title) {
            if (!title) {
                title = _t('Easypay Error');
            }
            Gui.showPopup('ErrorPopup', {
                'title': title,
                'body': msg,
            });
        },

        _pending_easypay_line: function () {
            return this.pos.get_order().paymentlines.find(
                paymentLine => paymentLine.payment_method.use_payment_terminal === 'easypay' && (!paymentLine.is_done()));
        },

        /**
         * @override
         */
        send_payment_request: async function (cid) {
            this._super.apply(this, arguments);
            if (this.pos.get_order().selected_paymentline.amount < 0 || this.pos.get_order().selected_paymentline.amount === 0) {
                this._show_error(_t('Cannot process transactions with negative amount.'));

                return Promise.resolve();
            }
            this.pos.get_order().selected_paymentline.set_payment_status('waitingCard');
            if (window.inAppPurchase) {
                this.pos.easyChannel = true;
                return this._android_purchase();
            } else if (typeof AndroidEasypayGateway !== 'undefined') {
                return this.sendTransactionToMada();
            }else {
                // return this.fromEasyPay({"message":"Payment Success","list":[{"end_date":"17/06/2023","status_message":{"arabic":"مقبولة","english":"Approved"},"cardholader_verfication_result":"3F0000","scheme":{"name":{"arabic":"مدى","english":"mada"},"id":"P1"},"system_trace_audit_number":"000164","pos_software_version_number":"1.0.0","retrieval_reference_number":"000000059464","entry_mode":"CONTACTLESS","action_code":"000","amount_authorized":{"name":{"arabic":"مبلغ الشراء","english":"PURCHASE AMOUNT"},"value":"25.30"},"tid":"0200084200000842","payment_account_reference":"","verification_method":{"arabic":"لا يتطلب التحقق","english":"NO VERIFICATION REQUIRED"},"qr_code":"https://sandbox-api.nearpay.io/ui/receipt/c9148b50-3192-4694-8c9b-99ebba0cfb93","currency":{"arabic":"ر.س","english":"SAR"},"receipt_line_two":{"arabic":"","english":""},"udid":"789ee182-b583-4781-ab5c-5167dfc54df9","pan":"5069 68** **** 0358","start_date":"17/06/2023","approval_code":{"label":{"arabic":"رمز الموافقة","english":"Approval Code"},"value":"904886"},"terminal_verification_result":"0080008000","application_cryptogram":"9E881D5A18AD3ACB","end_time":"17:07:31","thanks_message":{"arabic":"شكرا لاستخدامكم مدى","english":"Thank you for using mada"},"merchant":{"address":{"arabic":"4321","english":"KAFD"},"category_code":"0763","name":{"arabic":"NearPay Merchant Arabic","english":"NearPay Merchant"},"id":"100000000000001"},"card_expiration":"24/09","transaction_type":{"name":{"arabic":"شراء","english":"PURCHASE"},"id":"00"},"pan_suffix":"","transaction_state_information":"0000","receipt_line_one":{"arabic":"","english":""},"cryptogram_information_data":"80","start_time":"17:07:31","is_refunded":false,"kernel_id":"2d","save_receipt_message":{"arabic":"يرجى الاحتفاظ بالفاتورة","english":"please retain receipt"},"amount_other":{"name":{"arabic":"مبلغ الشراء","english":"PURCHASE AMOUNT"},"value":"25.30"},"is_approved":true,"application_identifier":"A0000002281010"}],"status":200})
                if (await this.connect()) {
                    return this._purchase_payment("PURCHASE");
                }
            }
            return Promise.resolve();
        },

        _android_purchase: async function () {
            const order = this.pos.get_order();
            const line = order.selected_paymentline;
            const args = [{
                method: "purchase",
                transactionId: order.uid,
                transactionAmount: Math.floor(line.amount * 100)
            }];
            this.pos.paymentProcessing = true
            const pollResponse = await window.inAppPurchase.callHandler('inAppPurchase', ...args);;
            this.pos.paymentProcessing = false
            this._CustomerDisplayReceipt();
            if (pollResponse === "false" || pollResponse === null) {
                line.set_payment_status('retry');
                return false;
            }
            this.pos.paymentDone = true
            var result = JSON.parse(pollResponse);
            this.pos.last_reuslt = result.qr_code
            line.set_payment_status('done');
            this._decode_response(result);
            return true;
            // window.easyPayChannel.postMessage("purchase," + this.payment_method.id + "," +
            //     Math.floor(line.amount * 100) + "," +
            //     order.uid);
            // this.pos.paymentProcessing = true
            // const myPromise = createControlledPromise();
            // return myPromise.then((message) => {
            //     return true; // This will run if the promise is resolved
            // }).catch((error) => {
            //     return false; // This will run if the promise is rejected
            // });
        },

        sendTransactionToMada: async function () {
            var self = this;
            const order = this.pos.get_order();
            const line = order.selected_paymentline;
            const data = JSON.stringify(
                {
                    method: "purchase",
                    customerReferenceNumber: order.uid,
                    amount: Math.floor(line.amount * 100)
                }
            )
            this.pos.paymentProcessing = true
            // await this._CustomerDisplayPayment()
            line.set_payment_status('waitingCard');
            return new Promise((resolve, reject) => {
                var currentCallbackId = callbackId++;
                    callbackMap[currentCallbackId] = resolve;
                self.pos.paymentProcessing = true
                AndroidEasypayGateway.sendData(data, currentCallbackId);
            }).then(async response => {
                this.pos.paymentProcessing = false
                this._CustomerDisplayReceipt();
                if (response === "false" || response === null) {
                    line.set_payment_status('force_done');
                    return false;
                }
                this.pos.paymentDone = true
                var result = JSON.parse(response);
                line.set_payment_status('done');
                this._decode_response(result);
                return true;
            });
        },

        send_payment_reversal: async function (cid) {
            this._super.apply(this, arguments);
            if (this.pos.get_order().selected_paymentline.amount > 0) {
                this._show_error(_t('Cannot process transactions with negative amount.'));

                return Promise.resolve();
            }
            this.pos.get_order().selected_paymentline.set_payment_status('waitingCard');
            const order = this.pos.get_order();
            const line = order.selected_paymentline;
            if (window.inAppPurchase) {
                return this._android_reverse();
            } else {
                // return this.fromEasyPay({"message":"Payment Success","list":[{"end_date":"17/06/2023","status_message":{"arabic":"مقبولة","english":"Approved"},"cardholader_verfication_result":"3F0000","scheme":{"name":{"arabic":"مدى","english":"mada"},"id":"P1"},"system_trace_audit_number":"000164","pos_software_version_number":"1.0.0","retrieval_reference_number":"000000059464","entry_mode":"CONTACTLESS","action_code":"000","amount_authorized":{"name":{"arabic":"مبلغ الشراء","english":"PURCHASE AMOUNT"},"value":"25.30"},"tid":"0200084200000842","payment_account_reference":"","verification_method":{"arabic":"لا يتطلب التحقق","english":"NO VERIFICATION REQUIRED"},"qr_code":"https://sandbox-api.nearpay.io/ui/receipt/c9148b50-3192-4694-8c9b-99ebba0cfb93","currency":{"arabic":"ر.س","english":"SAR"},"receipt_line_two":{"arabic":"","english":""},"udid":"789ee182-b583-4781-ab5c-5167dfc54df9","pan":"5069 68** **** 0358","start_date":"17/06/2023","approval_code":{"label":{"arabic":"رمز الموافقة","english":"Approval Code"},"value":"904886"},"terminal_verification_result":"0080008000","application_cryptogram":"9E881D5A18AD3ACB","end_time":"17:07:31","thanks_message":{"arabic":"شكرا لاستخدامكم مدى","english":"Thank you for using mada"},"merchant":{"address":{"arabic":"4321","english":"KAFD"},"category_code":"0763","name":{"arabic":"NearPay Merchant Arabic","english":"NearPay Merchant"},"id":"100000000000001"},"card_expiration":"24/09","transaction_type":{"name":{"arabic":"شراء","english":"PURCHASE"},"id":"00"},"pan_suffix":"","transaction_state_information":"0000","receipt_line_one":{"arabic":"","english":""},"cryptogram_information_data":"80","start_time":"17:07:31","is_refunded":false,"kernel_id":"2d","save_receipt_message":{"arabic":"يرجى الاحتفاظ بالفاتورة","english":"please retain receipt"},"amount_other":{"name":{"arabic":"مبلغ الشراء","english":"PURCHASE AMOUNT"},"value":"25.30"},"is_approved":true,"application_identifier":"A0000002281010"}],"status":200})
                if (await this.connect()) {
                    return this._purchase_payment("REFUND");
                }
            }
            return Promise.resolve();
        },

        _android_reverse: async function () {
            const order = this.pos.get_order();
            const line = order.selected_paymentline;
            // console.log('this.pos.udid',this.pos.udid)
            if (this.pos.udid) {
            const args = [{
                method: "refund",
                transactionId: this.pos.udid,
                transactionAmount: Math.floor(line.amount * 100)
            }];
            this.pos.paymentProcessing = true
            const pollResponse = await window.inAppPurchase.callHandler('inAppPurchase', ...args);;
            this.pos.paymentProcessing = false
            this._CustomerDisplayReceipt();
            if (pollResponse === "false" || pollResponse === null) {
                line.set_payment_status('retry');
                return false;
            }
            this.pos.paymentDone = true
            var result = JSON.parse(pollResponse);
            this.pos.last_reuslt = result.qr_code
            line.set_payment_status('done');
            this._decode_response(result);
            return true;
                // window.easyPayChannel.postMessage("refund," + this.payment_method.id + "," +
                //     Math.floor(line.amount * 100) + "," +
                //     this.pos.udid);
            } else {
                return false;
            }
            // return true;
        },


        connect: async function () {
            if (!this.pos.is_connected && this.pos.socket && this.pos.socket.readyState === 1) {
                return false;
            }
            return true;
        },

        _purchase_payment: async function (method) {
            let self = this;
            framework.blockUI();
            try {
                let socket = await self.socketrequest(method);
                return socket;
            } catch (error) {

                framework.unblockUI();
                // let url_error = url.replace("wss://", "").replace("/neoleap_integration", "")
                const {confirmed} = await Gui.showPopup('ConfirmPopup', {
                    title: _t('Device not connected'),
                    body: _.str.sprintf(_t('make sure the device connected and can be reached')),
                    confirmText: _t('Retry'),
                    cancelText: _t('Cancel'),
                });
                if (confirmed) {
                    self.send_payment_request();
                }
                return (false);
            }
        },

        socketrequest: function (method) {
            let self = this;
            var order = this.pos.get_order();
            var config = this.pos.config;
            var line = order.selected_paymentline;
            var pay_line = this._pending_easypay_line();
            var show_error = this._show_error
            var strAmount = line.amount.toString().replace("-", "")
            var amount = Number(strAmount)

            // return new Promise(function (resolve, reject) {
            if (self.pos.socket && self.pos.socket.readyState === 1) {
                var data = {
                    "amount": Math.floor(amount * 100),
                    "customerReferenceNumber": order.uid,
                    "method": method
                }
                if (method === "REFUND") {
                    if (!self.pos.udid) {
                        if (pay_line) {
                            pay_line.set_payment_status('retry');
                        }
                        rejectPromise();
                    }
                    data.transactionUuid = self.pos.udid
                }
                framework.blockUI();
                self.pos.socket.send(JSON.stringify(data));
                self.pos.paymentProcessing = true
            } else {
                self.pos.is_connected = false;
                self.render()
            }
            self.timeoutID = setTimeout(function () {
                self.pos.paymentProcessing = false
                framework.unblockUI();
                if (pay_line) {
                    pay_line.set_payment_status('retry');
                }
                rejectPromise();
            }, 65000);
            let counter = 0
            self.pos.socket.onerror = function (err) {
                self.pos.paymentProcessing = false
                framework.unblockUI();
                self.pos.is_connected = false;
                // self.render()
            }
            self.pos.socket.onclose = function () {
                self.pos.paymentProcessing = false
                framework.unblockUI();
                self.pos.is_connected = false;
                // self.render()
            }
            self.pos.socket.onmessage = async function (e) {
                var data = JSON.parse(e.data)
                if (e.data.length < 3) return
                if (self.timeoutID) {
                    clearTimeout(self.timeoutID);
                }
                // let self = this;
                // counter++;

                // console.log("data", data)
                if (data.error) {
                    self.pos.paymentProcessing = false
                    framework.unblockUI();
                    if (pay_line && pay_line.get_payment_status() !== 'done') {
                        pay_line.set_payment_status('retry');
                        const {confirmed} = await Gui.showPopup('ErrorPopup', {
                            title: _t('Device error'),
                            body: _.str.sprintf(_t('%s'), data.error),
                        });
                        rejectPromise();
                    } else {
                        const {confirmed} = await Gui.showPopup('ErrorPopup', {
                            title: _t('Device error'),
                            body: _.str.sprintf(_t('%s'), data.error),
                        });
                        rejectPromise();
                    }

                }
                if (data.message) {
                    var response = JSON.parse(data.message)
                    if (response.is_approved) {
                        self._CustomerDisplayReceipt();
                        line.set_payment_status('done');
                        self._decode_response(response);
                        self.pos.paymentProcessing = false
                        self.pos.paymentDone = true
                        framework.unblockUI();
                        // self.pos.dataMessage = data.message;
                        self.pos.last_reuslt = response.qr_code
                        resolvePromise();
                    } else {
                        self.pos.paymentProcessing = false
                        framework.unblockUI();
                        if (pay_line) {
                            pay_line.set_payment_status('retry');
                        }
                        const {confirmed} = await Gui.showPopup('ErrorPopup', {
                            title: (_t('%s'), response.action_code),
                            body: _.str.sprintf(_t('%s\n %s'), response.status_message.arabic, response.status_message.english),
                        });
                        rejectPromise();
                    }
                } else {
                    framework.unblockUI();
                }

            }
            const myPromise = createControlledPromise();
            return myPromise.then((message) => {
                return true; // This will run if the promise is resolved
            }).catch((error) => {
                return false; // This will run if the promise is rejected
            });
        },


        _refund: async function () {
            const order = this.pos.get_order();
            const line = order.selected_paymentline;
            if (!line.payment_transaction_uuid || !line.payment_transaction_uuid.length) {
                return false;
            }
            const refund = await this.pos.nearpay.getTerminal().refund({
                amount: Math.floor(line.amount * 100),
                original_transaction_uuid: line.payment_transaction_uuid,
                reference_id: order.uid,
                enable_receipt_ui: true,
                enable_reversal: true,
                enable_ui_dismiss: true,
                enable_editable_refund_amount_ui: true,
                finish_timeout: 60,
            })

            // handle acoording to the status
            if (refund.payload.status === REFUND_STATUS.APPROVED) {
                line.set_payment_status('refunded');
                this._decode_response(transaction.transactionReceipts);
            } else {
                line.set_payment_status('cancel');
            }
            return true;
        },
        _reverse: async function () {
            const order = this.pos.get_order();
            const line = order.selected_paymentline;
            if (!line.payment_transaction_uuid || !line.payment_transaction_uuid.length) {
                return false;
            }
            const reversal = await this.pos.nearpay.getTerminal().reversal({
                original_transaction_uuid: line.payment_transaction_uuid,
                enable_receipt_ui: true,
                finish_timeout: 60,
            })


            // handle acoording to the status
            if (reversal.payload.status === REVERSAL_STATUS.FINISHED) {
                line.set_payment_status('cancel');
                this._decode_response(transaction.transactionReceipts);
            } else {
                line.set_payment_status('cancel');
            }
            return true;
        },
        _reconcile: async function () {
            const order = this.pos.get_order();
            const line = order.selected_paymentline;
            const reconciliation = await this.pos.nearpay.getTerminal().reconcile({
                enable_receipt_ui: true,
                enable_ui_dismiss: true,
                finish_timeout: 60
            })

            // handle acoording to the status
            if (reconciliation.payload.status === RECONCILIATION_STATUS.BALANCED) {
                this._decode_response(transaction.transactionReceipts);
            }
            return true;
        },


        _decode_response: function (data) {
            const order = this.pos.get_order();
            const line = order.selected_paymentline;
            if (data) {
                line.set_payment_easypay_data(data);
            }
            return line;
        },

        async _CustomerDisplayReceipt() {
            var self = this;
            if (window.CustomerDisplay || self.pos.is_DeviceName && self.pos.is_connected) {
                if (self.pos.deviceModel === 'Z100') {
                    const renderedReceipt = renderToString('easypay_pos.EasyCustomerDisplay', {
                        _receipt: {
                            lineCount: 1,
                            line1: "شكرا",
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
                        self.pos.socket.send(CustomerDisplayMessage);
                    }
                    return
                } else if (self.pos.deviceModel === 'I22T01') {
                    const renderedReceipt = renderToString('easypay_pos.EasyCustomerDisplayimin', {
                        _receipt: {
                            lineCount: 1,
                            line1: "شكرا",
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
                        self.pos.socket.send(CustomerDisplayMessage);
                    }
                    return
                }
            }
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
    })
    return PaymentEasypay;
});