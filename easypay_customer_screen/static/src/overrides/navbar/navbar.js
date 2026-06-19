/** @odoo-module **/

import { Navbar } from "@point_of_sale/app/components/navbar/navbar";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

patch(Navbar.prototype, {
    setup() {
        super.setup();
        this.notification = useService("notification");
    },

    async sendSlideshowToCustomerScreen() {
        const pos = this.pos;
        if (!pos.config.show_easypay_customer_screen || pos.config._easypay_display_mode !== 'slideshow' || !pos.config._easypay_slide_image_ids?.length) {
            this.notification.add(
                _t("No slideshow images configured, display mode is not slideshow, or customer screen is disabled."),
                { type: "warning" }
            );
            return;
        }

        try {
            let successfulSend = false;
            
            // First clear existing slide images
            const clearCommand = {
                method: "clearSlideImages"
            };
            
            // Send clear command
            if (window.updateCustomerDisplay) {
                updateCustomerDisplay.postMessage(JSON.stringify(clearCommand));
                successfulSend = true;
            } else if (pos.socket && ![WebSocket.CLOSED, WebSocket.CLOSING].includes(pos.socket.readyState)) {
                pos.socket.send(JSON.stringify(clearCommand));
                successfulSend = true;
            }
            
            if (!successfulSend) {
                this.notification.add(
                    _t("Customer display connection not available."),
                    { type: "danger" }
                );
                return;
            }
            
            // Small delay to ensure clear command is processed
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Then add new slide images
            const slideImages = [];
            for (const image of pos.config._easypay_slide_image_ids) {
                slideImages.push({
                    contentId: `image_${image.id}`,
                    data: image.data
                });
            }

            const addCommand = {
                method: "addSlideImages",
                images: slideImages
            };

            if (window.updateCustomerDisplay) {
                updateCustomerDisplay.postMessage(JSON.stringify(addCommand));
            } else if (pos.socket && ![WebSocket.CLOSED, WebSocket.CLOSING].includes(pos.socket.readyState)) {
                pos.socket.send(JSON.stringify(addCommand));
            }
            
            // Show success notification
            this.notification.add(
                _t("Slideshow sent to customer screen successfully!"),
                { 
                    type: "success",
                    title: _t("Success"),
                    autocloseDelay: 3000
                }
            );
            
        } catch (e) {
            console.error("Error sending slideshow to customer screen:", e);
            this.notification.add(
                _t("Failed to send slideshow to customer screen. Please try again."),
                { 
                    type: "danger",
                    title: _t("Error"),
                    autocloseDelay: 5000
                }
            );
        }
    },

    async sendLogoToCustomerScreen() {
        const pos = this.pos;
        if (!pos.config.show_easypay_customer_screen || !pos.config._easypay_logo_image) {
            this.notification.add(
                _t("No logo image configured or customer screen is disabled."),
                { type: "warning" }
            );
            return;
        }

        try {
            let successfulSend = false;
            
            const logoCommand = {
                method: "setLogo",
                logo: {
                    contentId: `logo_${pos.config.id}`,
                    data: pos.config._easypay_logo_image.data,
                    filename: pos.config._easypay_logo_image.filename
                }
            };

            if (window.updateCustomerDisplay) {
                updateCustomerDisplay.postMessage(JSON.stringify(logoCommand));
                successfulSend = true;
            } else if (pos.socket && ![WebSocket.CLOSED, WebSocket.CLOSING].includes(pos.socket.readyState)) {
                pos.socket.send(JSON.stringify(logoCommand));
                successfulSend = true;
            }
            
            if (!successfulSend) {
                this.notification.add(
                    _t("Customer display connection not available."),
                    { type: "danger" }
                );
                return;
            }
            
            // Show success notification
            this.notification.add(
                _t("Logo updated on customer screen successfully!"),
                { 
                    type: "success",
                    title: _t("Success"),
                    autocloseDelay: 3000
                }
            );
            
        } catch (e) {
            console.error("Error sending logo to customer screen:", e);
            this.notification.add(
                _t("Failed to send logo to customer screen. Please try again."),
                { 
                    type: "danger",
                    title: _t("Error"),
                    autocloseDelay: 5000
                }
            );
        }
    },

    async sendWelcomeMessageToCustomerScreen() {
        const pos = this.pos;
        if (!pos.config.show_easypay_customer_screen || !pos.config._easypay_welcome_message) {
            this.notification.add(
                _t("No welcome message configured or customer screen is disabled."),
                { type: "warning" }
            );
            return;
        }

        try {
            let successfulSend = false;
            
            const welcomeCommand = {
                method: "setWelcomeMessage",
                message: pos.config._easypay_welcome_message
            };

            if (window.updateCustomerDisplay) {
                updateCustomerDisplay.postMessage(JSON.stringify(welcomeCommand));
                successfulSend = true;
            } else if (pos.socket && ![WebSocket.CLOSED, WebSocket.CLOSING].includes(pos.socket.readyState)) {
                pos.socket.send(JSON.stringify(welcomeCommand));
                successfulSend = true;
            }
            
            if (!successfulSend) {
                this.notification.add(
                    _t("Customer display connection not available."),
                    { type: "danger" }
                );
                return;
            }
            
            // Show success notification
            this.notification.add(
                _t("Welcome message sent to customer screen successfully!"),
                { 
                    type: "success",
                    title: _t("Success"),
                    autocloseDelay: 3000
                }
            );
            
        } catch (e) {
            console.error("Error sending welcome message to customer screen:", e);
            this.notification.add(
                _t("Failed to send welcome message to customer screen. Please try again."),
                { 
                    type: "danger",
                    title: _t("Error"),
                    autocloseDelay: 5000
                }
            );
        }
    }
}); 