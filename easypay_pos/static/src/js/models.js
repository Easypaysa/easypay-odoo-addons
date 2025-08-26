odoo.define('easypay_pos.models', function (require) {

    const {PosGlobalState, register_payment_method, Payment} = require('point_of_sale.models');

    const PaymentEasypay = require('easypay_pos.payment');
    const Registries = require('point_of_sale.Registries');

    register_payment_method('easypay', PaymentEasypay);

    const PosEasypayTerminalPosGlobalState = (PosGlobalState) => class PosEasypayTerminalPosGlobalState extends PosGlobalState {

        async load_server_data() {
            var self = this;
            if (window.easyPayChannel) {
                window.easyPayChannel.postMessage('start');
            }

            return super.load_server_data(...arguments);
        }

        async after_load_server_data() {
            await super.after_load_server_data(...arguments);
            if (window.easyPayChannel) {
                window.easyPayChannel.postMessage('done');
            }
            var self = this;
            const easypay_payment_method = _.find(self.payment_methods, function (payment_method) {
                return payment_method.use_payment_terminal === 'easypay' && self.config.payment_method_ids.includes(payment_method.id);
            })
            if (easypay_payment_method && !window.easyPayChannel && !window.inAppEasypay && !window.inAppPurchase && typeof AndroidEasypayGateway == 'undefined') {
                this.easypay_payment_method = true
            }
        }

    }
    Registries.Model.extend(PosGlobalState, PosEasypayTerminalPosGlobalState);

    const PosEasypayTerminalPayment = (Payment) => class PosEasypayTerminalPayment extends Payment {
    initialize(attr, options) {
            superPaymentline.initialize.call(this, attr, options);
            this.easypay_terminalid = this.easypay_terminalid || null;

        }
        export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        json.easypay_terminalid = this.easypay_terminalid;
            json.udid = this.transaction_uuid ? this.transaction_uuid : "";
            json.retrieval_reference_number = this.retrieval_reference_number ? this.retrieval_reference_number : "";
            json.pan = this.pan ? this.pan : "";
            json.entry_mode = this.entry_mode ? this.entry_mode : "";
            json.approval_code = this.approval_code ? this.approval_code.value : "";
            json.card_name = this.card_name ? this.card_name : "";
            json.merchant = this.merchant ? this.merchant.id : "";
            json.signature_required = this.signature_required ? this.signature_required : "";
            json.amount_authorized = this.amount_authorized ? this.amount_authorized.value : 0;
            json.payment_log = this.payment_log ? this.payment_log : "";
            json.transaction_id = this.retrieval_reference_number ? this.retrieval_reference_number : "";
            json.card_type = this.card_scheme ? this.card_scheme.name.english + " " + this.card_scheme.name.arabic : "";
            json.cardholder_name = this.pan ? this.pan : "";
            return json;
        }

        init_from_JSON(json) {
            super.init_from_JSON(...arguments);
            for (const key in json) {
                this[key] = json[key];
            }
        }

        export_for_printing() {
            const result = super.export_for_printing(...arguments);
            result.payment_method = this.payment_method;
            result.termprint = this.termreceipt;

            return result;
        }
        set_payment_easypay_data(data) {
            this.payment_log = data;
            for (const key in data) {
                this[key] = data[key];
            }
        }

    }
    Registries.Model.extend(Payment, PosEasypayTerminalPayment);
});