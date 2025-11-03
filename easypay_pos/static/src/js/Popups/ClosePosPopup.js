odoo.define('easypay_pos.ClosePosPopup', function (require) {
    'use strict';

    const ClosePosPopup = require('point_of_sale.ClosePosPopup');
    const Registries = require('point_of_sale.Registries');
    const {Gui} = require('point_of_sale.Gui');
    const {useState} = owl;
    const { renderToString } = require('@web/core/utils/render');
    var core = require('web.core');
    var _t = core._t;

    const EasypayClosePosPopup = (ClosePosPopup) =>
        class extends ClosePosPopup {


            async onReconciliation(method) {
                if (window.inAppEasypay) {
                    return this._handleInAppReconciliation(method);
                } else if (typeof AndroidEasypayGateway !== 'undefined') {
                    return this._handleAndroidReconciliation();
                } else {
                    return this._handleWebSocketReconciliation();
                }
            }

            async _handleInAppReconciliation(method) {
                try {
                    const args = [{ method: method }];
                    const pollResponse = await window.inAppEasypay.callHandler('inAppEasypay', ...args);
                    
                    if (pollResponse === "false" || pollResponse === null) {
                        Gui.showPopup('ErrorPopup', {
                            title: _t("Error"),
                            body: _t('Reconciliation failed'),
                        });
                        return;
                    }

                    const result = pollResponse;
                    if (result.is_balanced !== undefined && result.is_balanced.value) {
                        // Store the reconciliation receipt URL if available
                        if (result.qr_code) {
                            this.env.pos.last_reconciliation_receipt_url = result.qr_code;
                        }
                        
                        // Print last reconciliation if method is reconciliation
                        if (method === "reconciliation") {
                            const args = [{ method: "printLastReconciliation" }];
                            window.inAppEasypay.callHandler('inAppEasypay', ...args);
                        }
                    } else {
                        Gui.showPopup('ErrorPopup', {
                            title: _t("Error"),
                            body: _t("Reconciliation not completed"),
                        });
                    }
                } catch (error) {
                    console.error('InApp reconciliation error:', error);
                    Gui.showPopup('ErrorPopup', {
                        title: _t("Error"),
                        body: _t('Error during reconciliation'),
                    });
                }
            }

            async _handleAndroidReconciliation() {
                const data = JSON.stringify({
                    method: "reconcile",
                });
                AndroidEasypayGateway.reconcile(data);
            }

            async _handleWebSocketReconciliation() {
                if (!this.env.pos.socket || this.env.pos.socket.readyState !== 1) {
                    Gui.showPopup('ErrorPopup', {
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

                    this.env.pos.socket.send(JSON.stringify(data));

                    const originalOnMessage = this.env.pos.socket.onmessage;
                    this.env.pos.socket.onmessage = async (e) => {
                        try {
                            const data = JSON.parse(e.data);
                            
                            if (this.pollTimeout) {
                                clearTimeout(this.pollTimeout);
                            }

                            if (data.error || data === false) {
                                Gui.showPopup('ErrorPopup', {
                                    title: _t("Error"),
                                    body: _t('%s', data.error || 'Unknown error'),
                                });
                                reject(new Error(data.error));
                                return;
                            }

                            if (data.message) {
                                const response = JSON.parse(data.message);
                                if (response.is_balanced !== undefined && response.is_balanced.value) {                                    
                                    // Store the reconciliation receipt URL for later use
                                    if (response.qr_code) {
                                        this.env.pos.last_reconciliation_receipt_url = response.qr_code;
                                    }
                                    // Print reconciliation receipt using QWeb template with response data
                                    await this._printReconciliationReceipt(response.qr_code, response);
                                    resolve(true);
                                } else {
                                    Gui.showPopup('ErrorPopup', {
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
                            this.env.pos.socket.onmessage = originalOnMessage;
                        }
                    };
                }).catch(error => {
                    console.error('Reconciliation failed:', error);
                    Gui.showPopup('ErrorPopup', {
                        title: _t("Error"),
                        body: _t("Reconciliation failed"),
                    });
                });
            }

            async _printCustomReconciliationReceipt(reconciliationData) {
                try {
                    // Generate the reconciliation receipt HTML using your provided content
                    const receiptContent = this._generateReconciliationHTML(reconciliationData);
                    
                    if (this.env.proxy.printer) {
                        const printResult = await this.env.proxy.printer.print_receipt(receiptContent);
                        if (!printResult.successful) {
                            const {confirmed} = await this.showPopup('ConfirmPopup', {
                                title: _t("Printing error"),
                                body: _t('Do you want to print using the web printer?'),
                            });
                            
                            if (confirmed) {
                                this._printWebReconciliation(receiptContent);
                            }
                        }
                    } else {
                        this._printWebReconciliation(receiptContent);
                    }
                } catch (error) {
                    console.error('Error printing custom reconciliation receipt:', error);
                }
            }

            _printWebReconciliation(content) {
                const printWindow = window.open('', '', 'width=800,height=600');
                printWindow.document.write(content);
                printWindow.document.close();
                printWindow.onload = function () {
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                };
            }

            _generateReconciliationHTML(data) {
                const currentDate = new Date();
                const dateStr = currentDate.toLocaleDateString('en-GB');
                const timeStr = currentDate.toLocaleTimeString('en-GB');

                // Use your provided HTML template with dynamic data
                return `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>NearPay Receipt</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 20px;
                            background-color: #fff;
                            font-family: 'Courier New', monospace;
                            color: #000;
                            font-size: 12px;
                            line-height: 1.4;
                        }
                        .receipt-container {
                            max-width: 300px;
                            margin: 0 auto;
                        }
                        .receipt-header {
                            text-align: center;
                            margin-bottom: 20px;
                            border-bottom: 2px solid #000;
                            padding-bottom: 10px;
                        }
                        .receipt-header .title span {
                            display: block;
                            font-weight: bold;
                        }
                        .meta-datetime {
                            display: flex;
                            justify-content: space-between;
                            margin: 5px 0;
                        }
                        .meta-terminal {
                            display: flex;
                            justify-content: space-between;
                            margin: 5px 0;
                        }
                        .receipt-body {
                            margin: 20px 0;
                        }
                        .body-title {
                            text-align: center;
                            font-weight: bold;
                            margin-bottom: 15px;
                            border-bottom: 1px solid #000;
                            padding-bottom: 5px;
                        }
                        .details-container {
                            margin-bottom: 10px;
                            border-bottom: 1px dashed #000;
                            padding-bottom: 5px;
                        }
                        .details-title {
                            display: flex;
                            justify-content: space-between;
                            font-weight: bold;
                            margin-bottom: 3px;
                        }
                        .details-row {
                            display: flex;
                            justify-content: space-between;
                            font-size: 10px;
                        }
                        .receipt-footer {
                            text-align: center;
                            margin-top: 20px;
                            border-top: 2px solid #000;
                            padding-top: 10px;
                        }
                    </style>
                </head>
                <body>
                    <div class="receipt-container">
                        <div class="receipt-header">
                            <div class="title">
                                <span>NearPay Merchant Arabic</span>
                                <span>NearPay Merchant</span>
                                <span>4321</span>
                                <span>KAFD</span>
                            </div>
                            <div class="meta-datetime">
                                <span>${dateStr}</span>
                                <span>${timeStr}</span>
                            </div>
                            <div class="meta-terminal">
                                <span>100000000000001</span>
                                <span>0211258000112580</span>
                            </div>
                            <div class="meta-terminal">
                                <span>0763</span>
                                <span>000153</span>
                                <span>1.0.0</span>
                            </div>
                        </div>
                        <div class="receipt-body">
                            <div class="body-title">
                                <span>Reconciliation<br/>Totals Matched</span>
                                <span class="ar">موازنة<br/>المجاميع متوافقة</span>
                            </div>
                            <div class="details-container">
                                <div class="details-title">
                                    <span>mada</span>
                                    <span>مدى</span>
                                </div>
                                <div class="details-row">
                                    <span>No Transactions</span>
                                    <span></span>
                                    <span>لا يوجد عمليات</span>
                                </div>
                            </div>
                            <div class="details-container">
                                <div class="details-title">
                                    <span>Visa</span>
                                    <span>فيزا</span>
                                </div>
                                <div class="details-row">
                                    <span>No Transactions</span>
                                    <span></span>
                                    <span>لا يوجد عمليات</span>
                                </div>
                            </div>
                        </div>
                        <div class="receipt-footer">
                            <div>*** END OF RECONCILIATION ***</div>
                            <div>*** نهاية الموازنة ***</div>
                        </div>
                    </div>
                </body>
                </html>`;
            }

            async _printReconciliationReceipt(receiptUrl, reconciliationData = null) {
                try {
                    // If we have the data directly, use it; otherwise fetch from URL
                    let data = reconciliationData;
                    
                    if (!data && receiptUrl) {
                        // For device printing via socket (print image from URL)
                        if (this.env.pos.is_DeviceName && this.env.pos.is_connected && this.env.pos.config.print_order_receipt) {
                            if (this.env.pos.socket && this.env.pos.socket.readyState === 1) {
                                const message = JSON.stringify({
                                    'data': receiptUrl, 
                                    'cutter': true, 
                                    "method": "PrintImage"
                                });
                                this.env.pos.socket.send(message);
                                return;
                            }
                        }
                        
                        // Fetch the HTML page to extract JSON data
                        // Note: The URL returns an HTML page, not JSON directly
                        // We'll use the reconciliation data from the response instead
                        console.warn('Receipt URL provided but no data. URL:', receiptUrl);
                    }
                    
                    if (!data) {
                        console.error('No reconciliation data available for printing');
                        return;
                    }
                    
                    // Parse and prepare data for QWeb template
                    const templateData = this._parseReconciliationData(data);
                    
                    // Render the QWeb template
                    const receiptHtml = renderToString('ReconciliationReceipt', Object.assign({}, templateData, {
                        env: this.env,
                    }));
                    
                    // Print using thermal printer
                    if (this.env.proxy.printer) {
                        const printResult = await this.env.proxy.printer.print_receipt(receiptHtml);
                        
                        if (!printResult.successful) {
                            const {confirmed} = await this.showPopup('ConfirmPopup', {
                                title: _t("Printing error"),
                                body: _t('Do you want to print using the web printer?'),
                            });
                            
                            if (confirmed) {
                                this._printWebReconciliation(receiptHtml);
                            }
                        }
                    } else {
                        this._printWebReconciliation(receiptHtml);
                    }
                } catch (error) {
                    console.error('Error printing reconciliation receipt:', error);
                    Gui.showPopup('ErrorPopup', {
                        title: _t("Printing Error"),
                        body: _t('Failed to print reconciliation receipt: %s', error.message),
                    });
                }
            }

            _parseReconciliationData(responseData) {
                // The responseData is already parsed JSON from data.message
                // Structure it for the QWeb template
                return {
                    merchant: responseData.merchant || {},
                    date: responseData.date || '',
                    time: responseData.time || '',
                    card_acceptor_terminal_id: responseData.card_acceptor_terminal_id || '',
                    system_trace_audit_number: responseData.system_trace_audit_number || '',
                    pos_software_version_number: responseData.pos_software_version_number || '',
                    is_balanced: responseData.is_balanced || {},
                    details: responseData.details || null,
                    schemes: responseData.schemes || [],
                    currency: responseData.currency || { english: 'SAR', arabic: 'ر.س' },
                };
            }

        };

    Registries.Component.extend(ClosePosPopup, EasypayClosePosPopup);
    return EasypayClosePosPopup;
});
