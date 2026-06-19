/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { ClosePosPopup } from "@point_of_sale/app/components/popups/closing_popup/closing_popup";
import { useService } from "@web/core/utils/hooks";
import { useState, onWillStart } from "@odoo/owl";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { ask } from "@point_of_sale/app/utils/make_awaitable_dialog";

patch(ClosePosPopup.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.printer = useService("printer");
        
        // Add reconciliation state
        this.state = useState({
            ...this.state,
            reconciliation_total: 0,
            reconciliation_done: false,
        });

        onWillStart(async () => {
            await this.fetchReconciliationTotal();
        });
    },

    async fetchReconciliationTotal() {
        try {
            const records = await this.orm.searchRead(
                'daily.reconciliation',
                [['session_id', '=', this.pos.session.id]],
                ['total_total']
            );
            const total = records.reduce((acc, rec) => acc + rec.total_total, 0);
            this.state.reconciliation_total = total;
            if (total > 0) {
                this.state.reconciliation_done = true;
            }
        } catch (e) {
            console.error('Error fetching reconciliation total:', e);
            this.state.reconciliation_total = 0;
        }
    },

    async closeSession() {
        if (this.pos.config.mandatory_reconciliation && !this.state.reconciliation_done) {
            this.dialog.add(AlertDialog, {
                title: _t("Reconciliation Required"),
                body: _t("You must perform reconciliation before closing the session."),
            });
            return;
        }
        return super.closeSession();
    },

    async onReconciliation(method) {
        if (window.inAppEasypay) {
            return this._handleInAppReconciliation(method);
        } else if (typeof AndroidEasypayGateway !== 'undefined') {
            return this._handleAndroidReconciliation();
        } else {
            return this._handleWebSocketReconciliation();
        }
    },

    async _handleInAppReconciliation(method) {
        try {
            const args = [{ method: method }];
            const pollResponse = await window.inAppEasypay.callHandler('inAppEasypay', ...args);
            
            if (pollResponse === "false" || pollResponse === null) {
                this.dialog.add(AlertDialog, {
                    title: _t("Error"),
                    body: _t('Reconciliation failed'),
                });
                return;
            }

            const result = pollResponse;
            if (result.is_balanced !== undefined && result.is_balanced.value) {
                await this._saveReconciliation(result);
                
                // Print last reconciliation if method is reconciliation
                if (method === "reconciliation") {
                    const args = [{ method: "printLastReconciliation" }];
                    window.inAppEasypay.callHandler('inAppEasypay', ...args);
                }
            } else {
                this.dialog.add(AlertDialog, {
                    title: _t("Error"),
                    body: _t("Reconciliation not completed"),
                });
            }
        } catch (error) {
            console.error('InApp reconciliation error:', error);
            this.dialog.add(AlertDialog, {
                title: _t("Error"),
                body: _t('Error during reconciliation'),
            });
        }
    },

    async _handleAndroidReconciliation() {
        const data = JSON.stringify({
            method: "reconcile",
        });
        AndroidEasypayGateway.reconcile(data);
    },

    async _handleWebSocketReconciliation() {
        if (!this.pos.socket || this.pos.socket.readyState !== 1) {
            this.dialog.add(AlertDialog, {
                title: _t("Connection Error"),
                body: _t("Device not connected"),
            });
            return;
        }

        return new Promise((resolve, reject) => {
            const data = { method: "reconcile" };
            
            this.pollTimeout = setTimeout(() => {
                reject(new Error('Timeout'));
            }, 30000);

            this.pos.socket.send(JSON.stringify(data));

            const originalOnMessage = this.pos.socket.onmessage;
            this.pos.socket.onmessage = async (e) => {
                try {
                    const data = JSON.parse(e.data);
                    
                    if (this.pollTimeout) {
                        clearTimeout(this.pollTimeout);
                    }

                    if (data.error || data === false) {
                        this.dialog.add(AlertDialog, {
                            title: _t("Error"),
                            body: _t('%s', data.error || 'Unknown error'),
                        });
                        reject(new Error(data.error));
                        return;
                    }

                    if (data.message) {
                        const response = JSON.parse(data.message);
                        if (response.is_balanced !== undefined && response.is_balanced.value) {
                            await this._saveReconciliation(response);
                            
                            // Handle receipt printing
                            if (response.qr_code) {
                                await this._printReconciliationReceipt(response.qr_code);
                            }
                            resolve(true);
                        } else {
                            this.dialog.add(AlertDialog, {
                                title: _t("Error"),
                                body: _t("Reconciliation not completed"),
                            });
                            reject(new Error('Reconciliation not balanced'));
                        }
                    }
                } catch (error) {
                    console.error('WebSocket reconciliation error:', error);
                    reject(error);
                } finally {
                    // Restore original onmessage handler
                    this.pos.socket.onmessage = originalOnMessage;
                }
            };
        }).catch(error => {
            console.error('Reconciliation failed:', error);
            this.dialog.add(AlertDialog, {
                title: _t("Error"),
                body: _t("Reconciliation failed"),
            });
        });
    },

    async _saveReconciliation(result) {
        try {
            await this.orm.call(
                'daily.reconciliation',
                'create_from_json',
                [result, this.pos.session.id]
            );
            this.state.reconciliation_done = true;
            await this.fetchReconciliationTotal();
        } catch (error) {
            console.error('Error saving reconciliation:', error);
            this.dialog.add(AlertDialog, {
                title: _t("Error"),
                body: _t("Error saving reconciliation."),
            });
            throw error;
        }
    },

    async _printReconciliationReceipt(receiptUrl) {
        try {
            if (this.pos.is_DeviceName && this.pos.is_connected && this.pos.config.print_order_receipt) {
                // Handle device printing via socket
                if (this.pos.socket && this.pos.socket.readyState === 1) {
                    const message = JSON.stringify({
                        'data': receiptUrl, 
                        'cutter': true, 
                        "method": "PrintImage"
                    });
                    this.pos.socket.send(message);
                }
            } else {
                // Handle web printing
                const printResponse = await fetch(receiptUrl);
                const content = await printResponse.text();
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;
                const receiptContainerEl = tempDiv.querySelector('.receipt-container');
                
                if (receiptContainerEl) {
                    const printResult = await this.printer.printHtml(receiptContainerEl, {webPrintFallback: false});
                    
                    if (!printResult.successful) {
                        const confirmed = await ask(this.dialog, {
                            title: _t("Printing error"),
                            body: _t('Do you want to print using the web printer?'),
                        });
                        
                        if (confirmed) {
                            const printWindow = window.open(receiptUrl, '', 'width=800,height=600');
                            printWindow.document.close();
                            printWindow.onload = function () {
                                printWindow.focus();
                                printWindow.print();
                                printWindow.close();
                            };
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error printing reconciliation receipt:', error);
        }
    }
}); 