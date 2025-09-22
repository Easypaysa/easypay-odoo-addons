/** @odoo-module */

import {_t} from "@web/core/l10n/translation";
import {PaymentInterface} from "@point_of_sale/app/payment/payment_interface";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import {renderToElement} from "@web/core/utils/render";
import {htmlToCanvas} from "@point_of_sale/app/printer/render_service";
import { ask } from "@point_of_sale/app/store/make_awaitable_dialog";


const REQUEST_TIMEOUT = 65000;
let resolveExternal, rejectExternal;
let isSettled = false;
var callbackMap = {};
    var callbackId = 0;

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

function resolvePromise() {
    resolveExternal('Promise resolved successfully!');
}

// Function that rejects the promise
function rejectPromise() {
    if (rejectExternal !== undefined) {
        rejectExternal(new Error('There was an error with the promise.'));
    }

}

window.resolveCallback = function (callbackId, response) {
        // console.log("resolveCallback", response.toString())
        if (callbackMap[callbackId]) {
            callbackMap[callbackId](response);
            delete callbackMap[callbackId];
        }
    }

export class PaymentEasypay extends PaymentInterface {

    /**
     * @Override
     * @param { string } uuid
     * @returns Promise
     */
    async send_payment_request(uuid) {
        await super.send_payment_request(...arguments);
        const paymentLine = this.pos.get_order()?.get_selected_paymentline();
        const order = this.pos?.get_order();
        const retry = this._retryCountUtility(order.uuid)
        let transactionId = order.name.replace(" ", "").replaceAll("-", "").toUpperCase();
        if (retry > 0) {
           transactionId = transactionId.concat("retry", retry);
        }
        const transactionAmount = paymentLine.amount * 100;
        const timeStamp = Math.floor(Date.now() / 1000);

        // Preparing Unique Random Reference Id
        const referencePrefix = this.pos.config.name.replace(/\s/g, "").slice(0, 4)
        const referenceId = referencePrefix.concat(Math.floor(Math.random() * 1000000000))
        // const response = await this.makePaymentRequest(transactionAmount, transactionId, referenceId, timeStamp);
        if (window.inAppPurchase) {
            this.pos.easyChannel = true;
            return this._android_purchase(transactionAmount, transactionId, referenceId,);
        } else if (typeof AndroidEasypayGateway !== 'undefined') {
            return this.sendTransactionToMada(transactionAmount, transactionId, referenceId);
        } else {
            const response = await this.checkEasypayStatus();
            if (!response) {
                paymentLine.set_payment_status('force_done');
                this._incrementRetry(order.uuid);
                return false
            }
            paymentLine.set_payment_status('waitingCard');
            const pollResponse = await this.pollPayment(transactionAmount, transactionId, referenceId, "PURCHASE");
            if (pollResponse) {
                const retry_remove = true
                this._retryCountUtility(order.uuid, retry_remove)
                return true;
            } else {
                this._incrementRetry(order.uuid);
                return false;
            }
        }
    }

    async get_last_transaction_request(uuid) {
        const paymentLine = this.pos.get_order()?.get_selected_paymentline();
        const order = this.pos?.get_order();
        const retry = this._retryCountUtility(order.uuid)
        let transactionId = order.name.replace(" ", "").replaceAll("-", "").toUpperCase();
        if (retry > 0) {
           transactionId = transactionId.concat("retry", retry);
        }
        const transactionAmount = paymentLine.amount * 100;
        if (window.inAppPurchase) {
            this.pos.easyChannel = true;
            return this._get_last_transaction();
        } else {
            const response = await this.checkEasypayStatus();
            if (!response) {
                paymentLine.set_payment_status('force_done');
                this._incrementRetry(order.uuid);
                return false
            }
            paymentLine.set_payment_status('waitingCard');
            const pollResponse = await this.pollPayment(transactionAmount, transactionId, "", "GetLastTransaction");
            if (pollResponse) {
                const retry_remove = true
                this._retryCountUtility(order.uuid, retry_remove)
                return true;
            } else {
                this._incrementRetry(order.uuid);
                return false;
            }
        }
    }

    async _android_purchase(amount, transactionId, referenceId) {
        const paymentLine = this.pos.get_order()?.get_selected_paymentline();
        const order = this.pos?.get_order();
        // const args = [{
        //     method: "purchase",
        //     customerReferenceNumber: transactionId,
        //     amount: Math.floor(amount)
        // }];
        // this.pos.paymentProcessing = true
        // // await this._CustomerDisplayPayment()
        // paymentLine.set_payment_status('waitingCard');
        // const pollResponse = await window.inAppPurchase.callHandler('inAppEasypay', ...args);
        const args = [{
            method: "purchase",
            transactionId: transactionId,
            transactionAmount: Math.floor(amount)
        }];
        this.pos.paymentProcessing = true
        // await this._CustomerDisplayPayment()
        paymentLine.set_payment_status('waitingCard');
        const pollResponse = await window.inAppPurchase.callHandler('inAppPurchase', ...args);
        this.pos.paymentProcessing = false
        this._CustomerDisplayReceipt();
        if (pollResponse === "false" || pollResponse === null) {
            paymentLine.set_payment_status('force_done');
            this._incrementRetry(order.uuid);
            return false;
        }
        this.pos.paymentDone = true
        var result = JSON.parse(pollResponse);
        this.pos.last_reuslt = result.qr_code
        paymentLine.set_payment_status('done');
        await this._decode_response(result);
        const retry_remove = true
        this._retryCountUtility(order.uuid, retry_remove)
        return true;
    }

    async _get_last_transaction() {
        const paymentLine = this.pos.get_order()?.get_selected_paymentline();
        const order = this.pos?.get_order();
        const args = [{
            method: "getLastTransaction",
        }];
        this.pos.paymentProcessing = true
        // await this._CustomerDisplayPayment()
        paymentLine.set_payment_status('waitingCard');
        const pollResponse = await window.inAppPurchase.callHandler('inAppEasypay', ...args);
        this.pos.paymentProcessing = false
        this._CustomerDisplayReceipt();
        if (pollResponse === "false" || pollResponse === null) {
            paymentLine.set_payment_status('force_done');
            this._incrementRetry(order.uuid);
            return false;
        }
        this.pos.paymentDone = true
        var result = JSON.parse(pollResponse);
        paymentLine.amount = parseFloat(result.amount_authorized.value)
        this.pos.last_reuslt = result.qr_code
        paymentLine.set_payment_status('done');
        await this._decode_response(result);
        const retry_remove = true
        this._retryCountUtility(order.uuid, retry_remove)
        return true;
    }

    sendTransactionToMada(amount, transactionId, referenceId) {
        var self = this;
        const paymentLine = this.pos.get_order()?.get_selected_paymentline();
        const order = this.pos?.get_order();
        const data = JSON.stringify(
            {
                method: "purchase",
                customerReferenceNumber: transactionId,
                amount: Math.floor(amount)
            }
        )
        this.pos.paymentProcessing = true
        // await this._CustomerDisplayPayment()
        paymentLine.set_payment_status('waitingCard');
        return new Promise((resolve, reject) => {
            var currentCallbackId = callbackId++;
                callbackMap[currentCallbackId] = resolve;
            self.pos.paymentProcessing = true
            AndroidEasypayGateway.sendData(data, currentCallbackId);
        }).then(async response => {
            this.pos.paymentProcessing = false
            this._CustomerDisplayReceipt();
            if (response === "false" || response === null) {
                paymentLine.set_payment_status('force_done');
                this._incrementRetry(order.uuid);
                return false;
            }
            this.pos.paymentDone = true
            var result = JSON.parse(response);
            paymentLine.set_payment_status('done');
            await this._decode_response(result);
            const retry_remove = true
            this._retryCountUtility(order.uuid, retry_remove)
            return true;
        });
    }

    async fromEasyPay(transaction) {
        this.pos.paymentProcessing = false
        this._CustomerDisplayReceipt();
        const paymentLine = this.pos.get_order()?.get_selected_paymentline();
        const order = this.pos?.get_order();
        if (transaction === "false") {
            paymentLine.set_payment_status('force_done');
            this._incrementRetry(order.uuid);
            return rejectPromise();
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

        paymentLine.set_payment_status('done');
        await this._decode_response(result);
        const retry_remove = true
        this._retryCountUtility(order.uuid, retry_remove)
        resolvePromise()
        // }

    }

    /**
     * @Override
     * @param {} order
     * @param { string } uuid
     * @returns Promise
     */
    async send_payment_cancel(order, uuid) {
        await super.send_payment_cancel(...arguments);
        const paymentLine = this.pos.get_order()?.get_selected_paymentline();
        paymentLine.set_payment_status('retry');
        this._incrementRetry(order.uuid);
        clearTimeout(this.pollTimeout);
        if (this.pos.socket && this.pos.socket.readyState === 1) {
            var data = {
                "method": "RequestCancel"
            }
            this.pos.socket.send(JSON.stringify(data));
        }
        return true;
    }

    /**
     * @param { string } transactionId
     * @param { string } referenceId
     * @param { datetime } timestamp
     * @returns Promise
     */
    async pollPayment(amount, transactionId, referenceId, method) {
        let self = this;
        // const fetchPaymentStatus = async (resolve, reject) => {
        const paymentLine = this.pos.get_order()?.get_selected_paymentline();
        if (!paymentLine || paymentLine.payment_status == 'retry') {
            return false;
        }
        try {
            if (self.pos.socket && self.pos.socket.readyState === 1) {
                var data = {};
                if (method === "GetLastTransaction") {
                    data = {
                        "method": method
                    }
                } else {
                    data = {
                        "amount": Math.floor(amount),
                        "customerReferenceNumber": transactionId,
                        "method": method
                    }
                    if (method === "REFUND") {
                        if (!self.pos.udid) {
                            rejectPromise();
                        }
                        data.transactionUuid = self.pos.udid
                    }
                }
                
                self.pos.socket.send(JSON.stringify(data));
                await self._CustomerDisplayPayment()
                self.pos.paymentProcessing = true
                this.pollTimeout = setTimeout(function () {
                    self.pos.paymentProcessing = false
                    rejectPromise();
                }, REQUEST_TIMEOUT);
            } else {
                self.pos.is_connected = false;
                return self._showError(_t('make sure the device connected and can be reached'), _t('Device not connected'));
                rejectPromise();
            }
            self.pos.socket.onerror = function (err) {
                self.pos.paymentProcessing = false
                self.pos.is_connected = false;
                if (self.pollTimeout) {
                    clearTimeout(self.pollTimeout);
                }
                self._showError(_t('make sure the device connected and can be reached'), _t('Device not connected'));
                rejectPromise();
            }
            self.pos.socket.onclose = function () {
                self.pos.paymentProcessing = false
                self.pos.is_connected = false;
                if (self.pollTimeout) {
                    clearTimeout(self.pollTimeout);
                }
                rejectPromise();
            }
            self.pos.socket.onmessage = async function (e) {
                var data = JSON.parse(e.data)
                if (e.data.length < 3) return
                if (self.pollTimeout) {
                    clearTimeout(self.pollTimeout);
                }
                if (data.error || data === false) {
                    self.pos.paymentProcessing = false
                    self._showError(_t('%s', data.error), 'Device error');
                    // const {confirmed} = await self.env.services.popup.add(ConfirmPopup, {
                    //     title: _t('Device error'),
                    //     body: _t('%s', data.error),
                    //     confirmText: _t('Retry'),
                    //     cancelText: _t('Cancel'),
                    // });
                    // if (confirmed) {
                    //     self.send_payment_request();
                    // }
                    rejectPromise();
                }
                if (data.madaTransactionResult) {
                    self._CustomerDisplayReceipt();
                    self.pos.paymentProcessing = false
                    self.pos.paymentDone = true
                    await self._decode_mada_response(data.madaTransactionResult);
                    resolvePromise();
                }
                if (data.message) {
                    var response = JSON.parse(data.message)
                    if (response.is_approved) {
                        var amount_authorized = paymentLine.amount
                        if (response.amount_authorized !== undefined) {
                            amount_authorized = parseFloat(response.amount_authorized.value)
                        } else if (response.transaction_amount !== undefined) {
                            amount_authorized = parseFloat(response.transaction_amount) / 100
                        }
                        if (method === "GetLastTransaction") {
                            const confirmed = await ask(self.env.services.dialog, {
                                title: _t("Confirmation "),
                                body: _t('Are you sure you want to use the last transaction? with amount %s', amount_authorized),
                            });
                            if (!confirmed) {
                                self.pos.paymentProcessing = false
                                return rejectPromise();
                            }
                        }
                        self._CustomerDisplayReceipt();
                        // self._decode_response(response);
                        self.pos.paymentProcessing = false
                        self.pos.paymentDone = true
                        paymentLine.amount = amount_authorized
                        await self._decode_response(response);
                        resolvePromise();
                    } else {
                        self.pos.paymentProcessing = false
                        self._showError(_t('%s\n %s', response.status_message.arabic, response.status_message.english), 'Device error');
                        // const { confirmed } = await self.env.services.popup.add(ConfirmPopup, {
                        //     title: _t('%s', response.action_code),
                        //     body: _t('%s\n %s', response.status_message.arabic, response.status_message.english),
                        //     confirmText: _t('Retry'),
                        //     cancelText: _t('Cancel'),
                        // });
                        // if (confirmed) {
                        //     return self.send_payment_request();
                        // }
                        rejectPromise();
                    }
                } else {

                }

            }
        } catch (error) {
            const order = this.pos.get_order();
            this._incrementRetry(order.uuid);
            paymentLine.set_payment_status('force_done');
            this._showError(error, 'EasypayFetchPaymentStatus');
            return false;
        }
        ;
        // };
        const myPromise = createControlledPromise();
        return myPromise.then((message) => {
            return true; // This will run if the promise is resolved
        }).catch((error) => {
            return false; // This will run if the promise is rejected
        });
    }

    _decode_response(response) {
        const paymentLine = this.pos.get_order()?.get_selected_paymentline();
        // this.pos.last_reuslt = response.qr_code
        paymentLine.transaction_id = response?.id;
        // paymentLine.uuid = response?.transaction_uuid;
        paymentLine.payment_ref_no = response?.retrieval_reference_number;
        paymentLine.card_no = response?.pan;
        paymentLine.payment_method_payment_mode = response?.entry_mode;
        paymentLine.payment_method_authcode = response?.approval_code?.value;
        paymentLine.merchant = response?.merchant?.id;
        paymentLine.payment_method_issuer_bank = response?.card_scheme_sponsor;
        paymentLine.amount_authorized = response?.amount_authorized?.value;
        paymentLine.card_type = response?.card_scheme?.id;
        paymentLine.card_brand = response?.card_scheme?.name?.english + " " + response?.card_scheme?.name?.arabic;
        paymentLine.receipt_url = response?.qr_code;
        // paymentLine.payment_log = response;
        return true;
    }

    _decode_mada_response(response) {
        const paymentLine = this.pos.get_order()?.get_selected_paymentline();
        paymentLine.udid = "";
        paymentLine.retrieval_reference_number = response?.RRN;
        paymentLine.pan = response?.PAN;
        // paymentLine.entry_mode = response?.entry_mode;
        paymentLine.approval_code = response?.ApprovalCode;
        // paymentLine.card_name = response?.card_name;
        paymentLine.merchant = response?.MerchantID;
        paymentLine.card_type = response?.CardScheme?.English + " " + response?.CardScheme?.Arabic;
        // paymentLine.signature_required = response?.signature_required;
        // paymentLine.amount_authorized = response?.amount_authorized.value;
        paymentLine.payment_log = response;
        return true;
    }

    /**
     * @param { float } amount
     * @param { string } transactionId
     * @param { string } referenceId
     * @param { datetime } timestamp
     * @returns Promise
     */
    async checkEasypayStatus() {
        let self = this;
        if (!this.pos.is_connected && this.pos.socket && this.pos.socket.readyState === 1) {
            return false;
        }
        return true;
    }

    // ---------------------------------------------------------------------------
    // Private methods
    // ---------------------------------------------------------------------------

    _retryCountUtility(uuid, remove = false) {
        if (remove) {
            localStorage.removeItem(uuid);
        } else {
            return localStorage.getItem(uuid) || (localStorage.setItem(uuid, 0) && 0);
        }
    }

    _incrementRetry(uuid) {
        let retry = localStorage.getItem(uuid);
        localStorage.setItem(uuid, ++retry);
    }

    _showError(error_msg, title) {
        this.env.services.dialog.add(AlertDialog, {
            title: title || _t("Easypay Error"),
            body: error_msg,
        });
    }

    get totalDueText() {
        return this.env.utils.formatCurrency(this.pos.get_order()?.get_total_with_tax());
    }


    async _CustomerDisplayPayment() {
        var self = this;
        // console.log("deviceModel", self.pos.deviceModel);
        if (window.CustomerDisplay || self.pos.is_DeviceName && self.pos.is_connected) {
            // if (self.pos.deviceModel === 'Z100') {
            //
            //     const renderedReceipt = renderToElement('easypay_pos.EasyCustomerDisplay', {
            //         _receipt: {
            //             lineCount: 2,
            //             line1: "الرجاء تمرير البطاقة للدفع",
            //             line2: self.totalDueText,
            //         }
            //     });
            //
            //     const receipt_image_64 = await self.getReceiptImage(renderedReceipt);
            //     // console.log(receipt_image_64);
            //     var CustomerDisplayMessage = JSON.stringify({
            //         'data': receipt_image_64, 'cutter': true,
            //         "method": "CustomerDisplayMessage"
            //     });
            //     if (window.CustomerDisplay) {
            //         CustomerDisplay.postMessage(CustomerDisplayMessage);
            //     } else {
            //         self.pos.socket.send(CustomerDisplayMessage);
            //     }
            //     return
            // } else
            if (self.pos.deviceModel === 'I22T01') {
                const renderedReceipt = renderToElement('easypay_pos.EasyCustomerDisplayimin', {
                    _receipt: {
                        lineCount: 2,
                        line1: "الرجاء تمرير البطاقة للدفع",
                        line2: self.totalDueText,
                    }
                });
                const receipt_image_64 = await self.getReceiptImage(renderedReceipt);
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
    }

    async _CustomerDisplayReceipt() {
        var self = this;
        if (window.CustomerDisplay || self.pos.is_DeviceName && self.pos.is_connected) {
            if (self.pos.deviceModel === 'Z100') {
                const renderedReceipt = renderToElement('easypay_pos.EasyCustomerDisplay', {
                    _receipt: {
                        lineCount: 1,
                        line1: "شكرا",
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
                return
            } else if (self.pos.deviceModel === 'I22T01') {
                const renderedReceipt = renderToElement('easypay_pos.EasyCustomerDisplayimin', {
                    _receipt: {
                        lineCount: 1,
                        line1: "شكرا",
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
                return
            }
        }
    }

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
    }

    processCanvas(canvas) {
        return canvas.toDataURL("image/jpeg").replace("data:image/jpeg;base64,", "");
    }
}
