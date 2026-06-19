import { patch } from "@web/core/utils/patch";
import { PosPayment } from "@point_of_sale/app/models/pos_payment";

patch(PosPayment.prototype, {

    async getLastTransaction() {
        this.setPaymentStatus("waiting");

        return this.handlePaymentResponse(
            await this.payment_method_id.payment_terminal.get_last_transaction_request(this.uuid)
        );
    }


});