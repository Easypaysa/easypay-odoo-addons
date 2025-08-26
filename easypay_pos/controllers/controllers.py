# -*- coding: utf-8 -*-
# Copyright 2021 Artem Shurshilov

from odoo import http
from odoo.http import request
import werkzeug
from odoo.addons.web.controllers.home import Home

#http://localhost:8015/web/login?db=im_od_salla&login=admin&password=admin

class Easylogin(Home):

    @http.route('/web/login', type='http', auth="none")
    def web_login(self, redirect=None, **kw):
        res = super().web_login(redirect=redirect, **kw)
        login = request.params.get('login')
        password = request.params.get('password')
        if request.db and login and password:
            uid = request.session.authenticate(request.db, login, password)
            pos_id = request.params.get('posId')
            if pos_id:
                pos_config_id = request.env['pos.config'].sudo().search([('id', '=', pos_id)])
            if pos_id and pos_config_id:
                if not pos_config_id.current_session_id:
                    request.env['pos.session'].sudo().create({
                        'user_id': request.env.uid,
                        'config_id': pos_config_id.id
                    })
                return request.redirect(f'/pos/ui?config_id={pos_id}')
            else:
                url = '/web'
                return request.redirect(url)
        return res
