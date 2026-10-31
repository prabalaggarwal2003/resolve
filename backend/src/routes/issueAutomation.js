import express from 'express';
import { IssueAutomationRule, IssueEscalationRule, AssetTemplate } from '../models/index.js';
import { requireTabRead, requireTicketAction } from '../middleware/tabPermissions.js';
import {
  listAutomationRules,
  validateAutomationRulePayload,
} from '../services/issueAutomationService.js';
import {
  listEscalationRules,
  validateEscalationRulePayload,
  evaluateEscalations,
} from '../services/issueEscalationService.js';
import { ensureIssueOrgConfig } from '../services/issueOrgConfigService.js';
import Location from '../models/Location.js';

const router = express.Router();

/** List auto-assign + escalation rules + matcher option catalogs */
router.get('/automation', requireTabRead('issues'), requireTicketAction('manage_config'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const [config, automationRules, escalationRules, templates, locations] = await Promise.all([
      ensureIssueOrgConfig(orgId),
      listAutomationRules(orgId),
      listEscalationRules(orgId),
      AssetTemplate.find({ organizationId: orgId }).select('name').sort({ sortOrder: 1, name: 1 }).lean(),
      Location.find({ organizationId: orgId }).select('name path type').sort({ path: 1 }).limit(500).lean(),
    ]);

    const categories = [
      ...new Set((templates || []).map((t) => t.name).filter(Boolean)),
    ].sort();

    res.json({
      automationRules,
      escalationRules,
      options: {
        issueTypes: (config.issueTypes || []).map((t) => ({ id: t.id, name: t.name })),
        priorities: (config.priorities || []).map((p) => ({ id: p.id, name: p.name })),
        assetCategories: categories,
        locations: (locations || []).map((l) => ({
          _id: l._id,
          name: l.name,
          path: l.path,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post(
  '/automation/rules',
  requireTabRead('issues'),
  requireTicketAction('manage_config'),
  async (req, res) => {
    try {
      const v = validateAutomationRulePayload(req.body);
      if (!v.ok) return res.status(400).json({ message: v.message });
      const doc = await IssueAutomationRule.create({
        ...v.data,
        organizationId: req.user.organizationId,
        updatedBy: req.user._id,
      });
      const rules = await listAutomationRules(req.user.organizationId);
      res.status(201).json({ rule: doc, automationRules: rules });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.put(
  '/automation/rules/:id',
  requireTabRead('issues'),
  requireTicketAction('manage_config'),
  async (req, res) => {
    try {
      const v = validateAutomationRulePayload(req.body);
      if (!v.ok) return res.status(400).json({ message: v.message });
      const doc = await IssueAutomationRule.findOneAndUpdate(
        { _id: req.params.id, organizationId: req.user.organizationId },
        { $set: { ...v.data, updatedBy: req.user._id } },
        { new: true }
      );
      if (!doc) return res.status(404).json({ message: 'Rule not found' });
      const rules = await listAutomationRules(req.user.organizationId);
      res.json({ rule: doc, automationRules: rules });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.delete(
  '/automation/rules/:id',
  requireTabRead('issues'),
  requireTicketAction('manage_config'),
  async (req, res) => {
    try {
      const doc = await IssueAutomationRule.findOneAndDelete({
        _id: req.params.id,
        organizationId: req.user.organizationId,
      });
      if (!doc) return res.status(404).json({ message: 'Rule not found' });
      const rules = await listAutomationRules(req.user.organizationId);
      res.json({ automationRules: rules });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.post(
  '/escalation/rules',
  requireTabRead('issues'),
  requireTicketAction('manage_config'),
  async (req, res) => {
    try {
      const v = validateEscalationRulePayload(req.body);
      if (!v.ok) return res.status(400).json({ message: v.message });
      const doc = await IssueEscalationRule.create({
        ...v.data,
        organizationId: req.user.organizationId,
        updatedBy: req.user._id,
      });
      const rules = await listEscalationRules(req.user.organizationId);
      res.status(201).json({ rule: doc, escalationRules: rules });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.put(
  '/escalation/rules/:id',
  requireTabRead('issues'),
  requireTicketAction('manage_config'),
  async (req, res) => {
    try {
      const v = validateEscalationRulePayload(req.body);
      if (!v.ok) return res.status(400).json({ message: v.message });
      const doc = await IssueEscalationRule.findOneAndUpdate(
        { _id: req.params.id, organizationId: req.user.organizationId },
        { $set: { ...v.data, updatedBy: req.user._id } },
        { new: true }
      );
      if (!doc) return res.status(404).json({ message: 'Rule not found' });
      const rules = await listEscalationRules(req.user.organizationId);
      res.json({ rule: doc, escalationRules: rules });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.delete(
  '/escalation/rules/:id',
  requireTabRead('issues'),
  requireTicketAction('manage_config'),
  async (req, res) => {
    try {
      const doc = await IssueEscalationRule.findOneAndDelete({
        _id: req.params.id,
        organizationId: req.user.organizationId,
      });
      if (!doc) return res.status(404).json({ message: 'Rule not found' });
      const rules = await listEscalationRules(req.user.organizationId);
      res.json({ escalationRules: rules });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

/** Manual run for testing */
router.post(
  '/escalation/run',
  requireTabRead('issues'),
  requireTicketAction('manage_config'),
  async (req, res) => {
    try {
      const result = await evaluateEscalations({
        organizationId: req.user.organizationId,
        limit: 200,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
