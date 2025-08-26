odoo.define('easypay_pos.Chrome', function (require) {
    'use strict';
    const Registries = require('point_of_sale.Registries');
    const Chrome = require('point_of_sale.Chrome');
    var core = require('web.core');
    var _t = core._t;
    const {Gui} = require('point_of_sale.Gui');
    const models = require('point_of_sale.models');
    const {useState, useRef, useContext, useExternalListener} = owl;

    const easyPayChrome = Chrome => class extends Chrome {
        setup() {
            super.setup();
            this.env.pos.is_collapsed = false;
            this.env.pos.is_connected = false;
            this.state.portInputValue = '5000'
            this.running = 0;
            // window.onbeforeunload = function (e) {
            //         return "are you sure you want to leave? هل تود تحديث الصفحة";
            //     };

        }

        async start() {
            await super.start();
            this.state.ipInputValue = this.env.pos.config.easy_default_ip;
        }

        onCollapsed() {
            if (this.env.pos.is_collapsed === false) {
                this.env.pos.is_collapsed = true;
            } else {
                this.env.pos.is_collapsed = false;
            }

            this.render();
        }

        onConnected() {
            var self = this;
            if (this.running > 0) {
                // console.log("Call ignored, already running");
                return Gui.showPopup('ErrorPopup', {
                    title: "",
                    body: _t("Please wait a second we trying to connote the device"),
                });
            }
            ++this.running;
            if (this.state.ipInputValue !== '' && this.state.portInputValue !== '') {
                try {
                    // if (/Windows|iPad|iPhone|iPod/.test(navigator.userAgent)) {
                    if (this.env.pos.config.easy_connection_type === "secure") {
                        // alert("This is an iOS device.");
                        this.env.pos.socket = new WebSocket("wss://" + self.state.ipInputValue + ":" + 9000);

                    } else {
                        // alert("This is not an iOS device!");
                        this.env.pos.socket = new WebSocket("ws://" + self.state.ipInputValue + ":" + self.state.portInputValue);

                    }
                    this.env.pos.socket.onopen = function () {
                        self.env.pos.is_connected = true;
                        self.render()
                        // console.log("Done running");
                        --self.running;
                    };
                    this.env.pos.socket.onerror = function (err) {
                        // window.open("https://" + self.state.ipInputValue+ ":" + self.state.portInputValue,"_new");
                        // console.log("Done running");
                        --self.running;
                        // if (/Windows|iPad|iPhone|iPod/.test(navigator.userAgent)) {
                        if (self.env.pos.config.easy_connection_type === "secure") {
                            return Gui.showPopup('ErrorPopup', {
                                title: _t('Device not connected'),
                                body: _.str.sprintf(_t('make sure the device connected and can be reached at %s \n or try to open https://%s:9000 on new tab and select advanced and allow to process to it'), "wss://" + self.state.ipInputValue, self.state.ipInputValue),
                            });
                        } else {
                            return Gui.showPopup('ErrorPopup', {
                                title: _t('Device not connected'),
                                body: _.str.sprintf(_t('make sure the device connected and can be reached at %s'), "ws://" + self.state.ipInputValue + ":" + self.state.portInputValue),
                            });
                        }
                    };
                    this.env.pos.socket.onclose = function () {
                        self.env.pos.is_connected = false;
                        self.render()
                    }
                    this.env.pos.socket.onmessage = async function (e) {
                        var data = JSON.parse(e.data)
                        if (data.method === "WebSocketOpen") {
                            if (data.DeviceName !== 'null') {
                                self.env.pos.is_DeviceName = true;
                                self.env.pos.deviceModel = data.DeviceName;
                            } else if (data.DeviceName === 'null') {
                                self.env.pos.is_DeviceName = false;
                            }
                        }

                    }
                } catch (e) {
                    Gui.showPopup('ErrorPopup', {
                        'title': _t('Device not connected'),
                        'body': _.str.sprintf(_t('make sure the device connected and can be reached %s'), e),
                    });

                }

            } else {
                // console.log("Done running");
                --this.running;
            }

        }

        onDisCollapsed() {
            if (this.env.pos.socket && this.env.pos.socket.readyState === 1) {
                this.env.pos.socket.close()
                this.env.pos.is_connected = false;
                this.render();
            }

        }

    }
    Registries.Component.extend(Chrome, easyPayChrome);
    return easyPayChrome;
});