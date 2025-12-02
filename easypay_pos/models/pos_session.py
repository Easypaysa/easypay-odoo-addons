from odoo import models, fields, api


class PosSession(models.Model):
    _inherit = 'pos.session'

    total_reconciliation_amount = fields.Float(string="Reconciliation Total", compute="_compute_total_reconciliation_amount")

    @api.depends('total_reconciliation_amount')
    def _compute_total_reconciliation_amount(self):
        for session in self:
            # Sum the total_total from daily.reconciliation records related to this session
            reconciliations = self.env['daily.reconciliation'].search([('session_id', '=', session.id)])
            session.total_reconciliation_amount = sum(reconciliations.mapped('total_total'))

    @api.model
    def _load_pos_data_models(self, config_id):
        """Extend POS data models to include card schemes."""
        models = super()._load_pos_data_models(config_id)
        models.append('easypay.card.scheme')
        return models

    def action_show_daily_reconciliation(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Daily Reconciliations',
            'res_model': 'daily.reconciliation',
            'view_mode': 'list,form',
            'domain': [('session_id', '=', self.id)],
            'context': {'default_session_id': self.id},
        }
