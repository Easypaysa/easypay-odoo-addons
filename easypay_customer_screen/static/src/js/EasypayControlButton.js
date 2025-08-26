odoo.define('easypay_customer_screen.EasypayControlButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class EasypayControlButton extends PosComponent {
        get isEasypayEnabled() {
            return this.env.pos.config.show_easypay_customer_screen;
        }

        async onClick() {
            await this.updateEasypayCustomerScreen();
        }

        async updateEasypayCustomerScreen() {
            const pos = this.env.pos;
            if (!pos.config.show_easypay_customer_screen) {
                this.showNotification(
                    this.env._t("Easypay customer screen is disabled."),
                    3000
                );
                return;
            }

            try {
                let successfulSend = false;

                // Check connection
                if (window.updateCustomerDisplay) {
                    successfulSend = true;
                } else if (pos.socket && pos.socket.readyState === WebSocket.OPEN) {
                    successfulSend = true;
                }
                
                if (!successfulSend) {
                    this.showNotification(
                        this.env._t("Customer display connection not available."),
                        3000
                    );
                    return;
                }

                let commandsSent = 0;

                // 1. Send Logo if configured
                if (pos.config.easypay_logo_image) {
                    const logoCommand = {
                        method: "setLogo",
                        logo: {
                            contentId: `logo_${pos.config.id}`,
                            data: pos.config.easypay_logo_image,
                            filename: pos.config.easypay_logo_image_filename || 'logo.png'
                        }
                    };

                    if (window.updateCustomerDisplay) {
                        window.updateCustomerDisplay.postMessage(JSON.stringify(logoCommand));
                    } else {
                        pos.socket.send(JSON.stringify(logoCommand));
                    }
                    commandsSent++;
                }

                // 2. Send Slideshow if configured
                const slideImageIds = pos.config.easypay_slide_image_ids || [];
                if (pos.config.easypay_display_mode === 'slideshow' && slideImageIds.length > 0) {
                    // First clear existing slide images
                    const clearCommand = {
                        method: "clearSlideImages"
                    };
                    
                    if (window.updateCustomerDisplay) {
                        window.updateCustomerDisplay.postMessage(JSON.stringify(clearCommand));
                    } else {
                        pos.socket.send(JSON.stringify(clearCommand));
                    }
                    
                    // Small delay to ensure clear command is processed
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Load and format slide images
                    const formattedSlideImages = [];
                    try {
                        // Load image data from server for each ID
                        const imagePromises = slideImageIds.map(async (imageId) => {
                            try {
                                const imageData = await this.rpc({
                                    model: 'ir.attachment',
                                    method: 'read',
                                    args: [[imageId], ['datas']],
                                });
                                if (imageData && imageData[0] && imageData[0].datas) {
                                    return {
                                        contentId: `image_${imageId}`,
                                        data: imageData[0].datas
                                    };
                                }
                                return null;
                            } catch (e) {
                                console.error(`Failed to load image ${imageId}:`, e);
                                return null;
                            }
                        });
                        
                        const loadedImages = await Promise.all(imagePromises);
                        // Filter out failed loads
                        formattedSlideImages.push(...loadedImages.filter(img => img !== null));
                    } catch (e) {
                        console.error('Error loading slide images:', e);
                        this.showNotification(
                            this.env._t("Failed to load slide images."),
                            3000
                        );
                        return;
                    }

                    const addCommand = {
                        method: "addSlideImages",
                        images: formattedSlideImages
                    };

                    if (window.updateCustomerDisplay) {
                        window.updateCustomerDisplay.postMessage(JSON.stringify(addCommand));
                    } else {
                        pos.socket.send(JSON.stringify(addCommand));
                    }
                    commandsSent++;
                }

                // 3. Send Welcome Message if configured (and not slideshow mode)
                if (pos.config.easypay_welcome_message && pos.config.easypay_display_mode !== 'slideshow') {
                    const welcomeCommand = {
                        method: "setWelcomeMessage",
                        message: pos.config.easypay_welcome_message
                    };

                    if (window.updateCustomerDisplay) {
                        window.updateCustomerDisplay.postMessage(JSON.stringify(welcomeCommand));
                    } else {
                        pos.socket.send(JSON.stringify(welcomeCommand));
                    }
                    commandsSent++;
                }

                // Show success notification
                if (commandsSent > 0) {
                    this.showNotification(
                        this.env._t("Easypay customer screen updated successfully!"),
                        3000
                    );
                } else {
                    this.showNotification(
                        this.env._t("No content configured to send to customer screen."),
                        3000
                    );
                }
                
            } catch (e) {
                console.error("Error updating Easypay customer screen:", e);
                this.showNotification(
                    this.env._t("Failed to update customer screen. Please try again."),
                    5000
                );
            }
        }


    }
    EasypayControlButton.template = 'easypay_customer_screen.EasypayControlButton';

    Registries.Component.add(EasypayControlButton);

    return EasypayControlButton;
});
