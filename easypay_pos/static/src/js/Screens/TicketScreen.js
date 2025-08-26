odoo.define('easypay_pos.TicketScreen', function (require) {
    'use strict';
    const TicketScreen = require('point_of_sale.TicketScreen');
    const Registries = require('point_of_sale.Registries');

   const EasypayCustomTicketScreen = (TicketScreen) =>

        class extends TicketScreen {
            async _onDoRefund() {
                var self = this
                const order = self.getSelectedSyncedOrder();
                if (!order) {
                    self._state.ui.highlightHeaderNote = !self._state.ui.highlightHeaderNote;
                    return self.render();
                }

                if (order) {
                    self.env.pos.udid = order.selected_paymentline.udid
                }
                return super._onDoRefund()
            }
        };

    Registries.Component.extend(TicketScreen, EasypayCustomTicketScreen);

    return TicketScreen;
});
