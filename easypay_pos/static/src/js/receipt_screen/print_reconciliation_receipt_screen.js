/** @odoo-module */

import { usePos } from "@point_of_sale/app/store/pos_hook";
import { registry } from "@web/core/registry";
import { Component, onWillStart, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { htmlToCanvas } from "@point_of_sale/app/printer/render_service";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";

export class PrintReconciliationReceiptScreen extends Component {
  static template = "easypay_pos.PrintReconciliationReceiptScreen";

  setup() {
    super.setup();
    this.pos = usePos();
    this.printer = useService("printer");
    this.popup = useService("popup");
    this.renderer = useService("renderer");

    this.state = useState({
      receipt: this.props.receipt,
    });

    onMounted(this.onMounted);
  }

  onMounted() {
    let self = this;
    self.env.services.ui.block();
    setTimeout(async function () {
      var ResultReceipt = self.state.receipt
      if (!ResultReceipt) return;
      var printdiv = await fetch(ResultReceipt);
      var content = await printdiv.text();
      var parser = new DOMParser();
      var doc = parser.parseFromString(content, 'text/html');
      // var styles = doc.querySelector('style').innerHTML;
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
                }`
      var receiptContent = doc.querySelector('.receipt-container').outerHTML;
      var combinedContent = `<style>${styles}</style>${receiptContent}`;
      var doc = document.getElementsByClassName("pos-receipt");
      this.el = doc[0];
      doc[0].innerHTML = combinedContent
      self.receiptString = doc[0].outerHTML;
      self.env.services.ui.unblock();
    }, 500);
  }

  confirm() {
    this.props.resolve({ confirmed: false, payload: false });
    this.pos.closeTempScreen();
  }

  async tryReprint() {

    const printResult = await this.printer.printHtml(el, { webPrintFallback: false });
    if (printResult.successful) {
      return true;
    } else {
      const { confirmed } = await this.env.services.dialog.add(AlertDialog, {
        title: _t("Printing error"),
        body: 'Do you want to print using the web printer?',
      });
      if (confirmed) {
        return this.renderer.whenMounted({ el, callback: window.print });
      }
      return false;
    }
  }

  async getReceiptImage(receipt) {
    this.receiptQueue = [];
    if (receipt) {
      this.receiptQueue.push(receipt);
    }
    let image, printResult;
    while (this.receiptQueue.length > 0) {
      receipt = this.receiptQueue.shift();
      image = this.processCanvas(
        await htmlToCanvas(receipt, { addClass: "pos-receipt-print" })
      );
    }
    return image;
  }

  processCanvas(canvas) {
    return canvas.toDataURL("image/jpeg").replace("data:image/jpeg;base64,", "");
  }
}

registry.category("pos_screens").add("PrintReconciliationReceiptScreen", PrintReconciliationReceiptScreen);
