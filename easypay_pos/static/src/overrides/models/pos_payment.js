import { patch } from "@web/core/utils/patch";
import { PosPayment } from "@point_of_sale/app/models/pos_payment";

patch(PosPayment.prototype, {

    async getLastTransaction() {
        this.set_payment_status("waiting");

        return this.handle_payment_response(
            await this.payment_method_id.payment_terminal.get_last_transaction_request(this.uuid)
        );
    }


});