/** @odoo-module */

import { Navbar } from "@point_of_sale/app/navbar/navbar";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { patch } from "@web/core/utils/patch";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { ask } from "@point_of_sale/app/store/make_awaitable_dialog";
import { Component, onMounted, useState } from "@odoo/owl";
import { renderToElement } from "@web/core/utils/render";
import { htmlToCanvas } from "@point_of_sale/app/printer/render_service";
import { PrintReconciliationReceiptScreen } from "../../../js/receipt_screen/print_reconciliation_receipt_screen";
// import { PrintReconciliationReceiptScreen } from "@easypay_pos/js/receipt_screen/print_reconciliation_receipt_screen";

patch(Navbar.prototype, {
    setup() {
        super.setup();
        this.pos = usePos();
        this.pos.is_collapsed = false;
        this.pos.is_connected = false;
        this.hardwareProxy = useService("hardware_proxy");
        this.printer = useService("printer");
        this.renderer = useService("renderer");
        this.running = 0;
        this.state = useState({ portInputValue: '5000', ipInputValue: this.pos.config.easy_default_ip });

    },


    onCollapsed() {
        if (this.pos.is_collapsed === false) {
            this.pos.is_collapsed = true;
        } else {
            this.pos.is_collapsed = false;
        }
        this.render();
    },

    onConnected() {
        var self = this;
        if (this.running > 0) {
            // console.log("Call ignored, already running");
            return this.env.services.dialog.add(AlertDialog, {
                title: "",
                body: _t("Please wait a second we trying to connote the device"),
            });
        }
        ++this.running;
        if (this.state.ipInputValue !== '' && this.state.portInputValue !== '') {
            try {
                // if (/Windows|iPad|iPhone|iPod/.test(navigator.userAgent)) {
                if (this.pos.config.easy_connection_type === "secure") {
                    // alert("This is an iOS device.");
                    this.pos.socket = new WebSocket("wss://" + self.state.ipInputValue + ":" + 9000);

                } else {
                    // alert("This is not an iOS device!");
                    this.pos.socket = new WebSocket("ws://" + self.state.ipInputValue + ":" + self.state.portInputValue);

                }
                this.pos.socket.onopen = function () {
                    self.pos.is_connected = true;
                    self.render()
                    // console.log("Done running");
                    --self.running;
                };
                this.pos.socket.onerror = function (err) {
                    // window.open("https://" + self.state.ipInputValue+ ":" + self.state.portInputValue,"_new");
                    // console.log("Done running");
                    --self.running;
                    // if (/Windows|iPad|iPhone|iPod/.test(navigator.userAgent)) {
                    if (self.pos.config.easy_connection_type === "secure") {
                        return self.env.services.dialog.add(AlertDialog, {
                            title: _t('Device not connected'),
                            body: _t('make sure the device connected and can be reached at %s \n or try to open https://%s:9000 on new tab and select advanced and allow to process to it', "wss://" + self.state.ipInputValue, self.state.ipInputValue),
                        });
                    } else {
                        return self.env.services.dialog.add(AlertDialog, {
                            title: _t('Device not connected'),
                            body: _t('make sure the device connected and can be reached at %s', "ws://" + self.state.ipInputValue + ":" + self.state.portInputValue),
                        });
                    }
                };
                this.pos.socket.onclose = function () {
                    self.pos.is_connected = false;
                    self.render()
                }
                this.pos.socket.onmessage = async function (e) {
                    var data = JSON.parse(e.data)
                    if (data.method === "WebSocketOpen") {
                        if (data.DeviceName !== 'null') {
                            self.pos.is_DeviceName = true;
                            self.pos.deviceModel = data.DeviceName;
                        } else if (data.DeviceName === 'null') {
                            self.pos.is_DeviceName = false;
                        }
                    }

                }
            } catch (e) {
                this.env.services.dialog.add(AlertDialog, {
                    'title': _t('Device not connected'),
                    'body': _t('make sure the device connected and can be reached %s', e),
                });

            }

        } else {
            // console.log("Done running");
            --this.running;
        }

    },

    onDisCollapsed() {
        if (this.pos.socket && this.pos.socket.readyState === 1) {
            this.pos.socket.close()
            this.pos.is_connected = false;
            this.render();
        }

    },


    processCanvas(canvas) {
        return canvas.toDataURL("image/jpeg").replace("data:image/jpeg;base64,", "");
    },
});