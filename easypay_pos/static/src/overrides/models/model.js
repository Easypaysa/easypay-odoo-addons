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

            // Get all EasyPay payment methods
            self.easypayPaymentMethods = self.config.payment_method_ids.filter(
                (pm) => pm.use_payment_terminal === 'easypay'
            );

            // Build lookup map: scheme code -> payment methods
            self.buildSchemeToPaymentMethodMap();

            const easypay_payment_method = self.config.payment_method_ids.find((payment_method) => {
                return payment_method.use_payment_terminal === 'easypay';
            });
            if (easypay_payment_method && !window.easyPayChannel && !window.inAppEasypay && !window.inAppPurchase && typeof AndroidEasypayGateway == 'undefined') {
                self.easypay_payment_method = true;
            }
        });
    },

    /**
     * Build a map from card scheme code to payment methods.
     * This is used to remap payment methods after a successful EasyPay transaction.
     * Multiple payment methods may have the same scheme; we store all and take the first when needed.
     */
    buildSchemeToPaymentMethodMap() {
        this.schemeToPaymentMethods = {};

        // Get all card schemes from loaded data
        const cardSchemes = this.models['easypay.card.scheme']?.getAll() || [];

        // For each EasyPay payment method, map its assigned schemes
        for (const paymentMethod of this.easypayPaymentMethods || []) {
            const schemeIds = paymentMethod.easypay_card_scheme_ids || [];
            for (const schemeId of schemeIds) {
                // Find the scheme by ID
                const scheme = cardSchemes.find((s) => s.id === schemeId.id);
                if (scheme) {
                    // Store array of methods per scheme code
                    if (!this.schemeToPaymentMethods[scheme.code]) {
                        this.schemeToPaymentMethods[scheme.code] = [];
                    }
                    this.schemeToPaymentMethods[scheme.code].push(paymentMethod);
                }
            }
        }
    },

    /**
     * Get the first payment method for a given card scheme code.
     * If multiple payment methods have the same scheme, returns the first one.
     * @param {string} schemeCode - The card scheme code (e.g., 'P1', 'VC')
     * @returns {Object|null} - The payment method or null if not found
     */
    getPaymentMethodBySchemeCode(schemeCode) {
        const methods = this.schemeToPaymentMethods[schemeCode];
        return methods && methods.length > 0 ? methods[0] : null;
    },

    /**
     * Get the base EasyPay payment method (first one) for initiating transactions.
     * @returns {Object|null} - The base payment method or null if not found
     */
    getBaseEasypayPaymentMethod() {
        return this.easypayPaymentMethods && this.easypayPaymentMethods.length > 0
            ? this.easypayPaymentMethods[0]
            : null;
    },

    /**
     * Check if there are multiple EasyPay payment methods configured.
     * @returns {boolean}
     */
    hasMultipleEasypayMethods() {
        return this.easypayPaymentMethods && this.easypayPaymentMethods.length > 1;
    },
});