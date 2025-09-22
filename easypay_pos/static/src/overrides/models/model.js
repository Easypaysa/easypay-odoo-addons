import { register_payment_method } from "@point_of_sale/app/store/pos_store";
import { PaymentEasypay } from '@easypay_pos/js/payment_easypay';
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { patch } from "@web/core/utils/patch";

    register_payment_method('easypay', PaymentEasypay);

patch(PosStore.prototype, {


    async initServerData() {
        await super.initServerData(...arguments);
        if (window.easyPayChannel) {
                window.easyPayChannel.postMessage('start');
            }
    },
    async afterProcessServerData() {
        var self = this;
        await super.afterProcessServerData(...arguments).then(function () {

            if (window.easyPayChannel) {
                window.easyPayChannel.postMessage('done');
            }
            const easypay_payment_method = self.config.payment_method_ids.find((payment_method) =>{
                return payment_method.use_payment_terminal === 'easypay'});
            if (easypay_payment_method && !window.easyPayChannel && !window.inAppEasypay && !window.inAppPurchase && typeof AndroidEasypayGateway == 'undefined') {
                self.easypay_payment_method = true
            }
        });
    },
});