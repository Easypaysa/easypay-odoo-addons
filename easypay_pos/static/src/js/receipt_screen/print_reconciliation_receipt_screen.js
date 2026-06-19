/** @odoo-module */

import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { Component, useRef, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";
import { ask } from "@point_of_sale/app/utils/make_awaitable_dialog";
import { _t } from "@web/core/l10n/translation";

export class PrintReconciliationReceiptScreen extends Component {
  static template = "easypay_pos.PrintReconciliationReceiptScreen";
  static components = { Dialog };
  static props = {
    receipt: { type: String, optional: true },
    close: { type: Function },
  };

  setup() {
    this.pos = usePos();
    this.printer = useService("printer");
    this.renderer = useService("renderer");
    this.ui = useService("ui");
    this.dialog = useService("dialog");
    this.receiptRef = useRef("receipt");

    this.state = useState({
      receipt: this.props.receipt,
    });

    onMounted(this.onMounted);
  }

  onMounted() {
    let self = this;
    self.ui.block();
    setTimeout(async function () {
      try {
        var ResultReceipt = self.state.receipt;
        if (!ResultReceipt) {
          return;
        }
        var printdiv = await fetch(ResultReceipt);
        var content = await printdiv.text();
        var parser = new DOMParser();
        var doc = parser.parseFromString(content, 'text/html');
        var styles = `
                html {
                    font-family: sans-serif;
                    -ms-text-size-adjust: 100%;
                    -webkit-text-size-adjust: 100%;
                    height: 100%;
                  }

                  body {
                    margin: 0;
                    min-height: 100%;
                    padding: 0;
                    background-color: #f9f9f9;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
                      Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans',
                      'Helvetica Neue', sans-serif;
                    color: #000;
                    font-size: 27px;
                    font-weight: 600;
                    background: #e5e7eb !important;
                  }
                .print .receipt-container {
                  box-shadow: none !important;
                }

                .receipt-container {
                  width: 512px;
                  margin: 0 auto;
                  background: #fff;
                }

                .receipt-header {
                  padding: 10px 5px;
                }

                .receipt-header .title {
                  margin: 0 auto;
                  text-align: center;
                  font-weight: bold;
                }

                .receipt-header .title span {
                  display: block;
                }

                .receipt-header .meta {
                  font-weight: 800;
                }

                .receipt-header .meta .meta-datetime {
                  display: flex;
                  flex-direction: row;
                  justify-content: space-between;
                  align-items: center;
                }

                .receipt-header .meta .meta-terminal {
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  justify-content: space-between;
                }

                .receipt-body .body-title {
                  display: flex;
                  flex-direction: row;
                  justify-content: space-between;
                  align-items: center;
                  padding: 0 5px;
                  margin-bottom: 5px;
                  font-weight: bold;
                }

                .receipt-body .body-title .ar {
                  text-align: right;
                }

                .receipt-body .details-container {
                  border-top: 2px solid #000;
                  padding: 0 5px;
                  margin-bottom: 10px;
                }

                .receipt-body .details-container .details-title {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  margin-bottom: 5px;
                  font-weight: bold;
                }

                .receipt-body .details-container .details-row {
                  display: flex;
                  flex-direction: row;
                  justify-content: space-evenly;
                  align-items: center;
                  text-align: center;
                  margin-bottom: 5px;
                }

                .receipt-body .details-container .details-row div {
                  flex: 1;
                }

                .receipt-footer {
                  border-top: 2px solid #000;
                  padding: 5px;
                }

                .receipt-footer .meta-datetime {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 10px;
                  font-weight: 300;
                }

                .receipt-footer .instructions {
                  font-weight: bold;
                  text-align: center;
                }

                .receipt-footer .instructions span {
                  display: block;
                }

                .receipt-footer .powered-by {
                  font-weight: bold;
                  margin-top: 15px;
                  text-align: center;
                }

                hr{
                  margin: 0.5rem 1.5rem;
                  height:1px;
                  background-color:#000;
                }`;
        var receiptEl = doc.querySelector('.receipt-container');
        if (receiptEl && self.receiptRef.el) {
          self.receiptRef.el.innerHTML = `<style>${styles}</style>${receiptEl.outerHTML}`;
        }
      } finally {
        self.ui.unblock();
      }
    }, 500);
  }

  confirm() {
    this.props.close();
  }

  async tryReprint() {
    const el = this.receiptRef.el;
    if (!el) {
      return false;
    }
    const printResult = await this.printer.printHtml(el, { webPrintFallback: false });
    if (printResult.successful) {
      return true;
    }
    const confirmed = await ask(this.dialog, {
      title: _t("Printing error"),
      body: _t("Do you want to print using the web printer?"),
    });
    if (confirmed) {
      return this.renderer.whenMounted({ el, callback: window.print });
    }
    return false;
  }
}
