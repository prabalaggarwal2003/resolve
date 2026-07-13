import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireTabRead, requireTabWrite } from '../middleware/tabPermissions.js';
import {
  INSIGHT_CATEGORIES,
  INSIGHT_METRIC_CATALOG,
  INSIGHT_OPERATORS,
  INSIGHT_SEVERITIES,
  DEFAULT_INSIGHT_THRESHOLDS,
} from '../constants/insightDefaults.js';
import {
  getInsightOrgConfig,
  updateInsightOrgConfig,
  listInsightRules,
  getInsightRuleById,
  updateInsightRule,
  createCustomInsightRule,
  deleteInsightRule,
  resetInsightRule,
} from '../services/insightOrgConfigService.js';
import { evaluateInsights } from '../services/insightEvaluatorService.js';

const router = express.Router();
router.use(protect);

/** GET /api/insights/catalog — metrics & operators for rule builder */
router.get('/catalog', requireTabRead('insights'), (_req, res) => {
  res.json({
    metrics: INSIGHT_METRIC_CATALOG,
    operators: INSIGHT_OPERATORS,
    severities: INSIGHT_SEVERITIES,
    categories: INSIGHT_CATEGORIES,
    defaultThresholds: DEFAULT_INSIGHT_THRESHOLDS,
  });
});

/** GET /api/insights/config */
router.get('/config', requireTabRead('insights'), async (req, res) => {
  try {
    const config = await getInsightOrgConfig(req.user.organizationId);
    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** PUT /api/insights/config */
router.put('/config', requireTabWrite('insights'), async (req, res) => {
  try {
    const config = await updateInsightOrgConfig(req.user.organizationId, req.user._id, req.body);
    res.json({ config });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/** GET /api/insights/rules */
router.get('/rules', requireTabRead('insights'), async (req, res) => {
  try {
    const rules = await listInsightRules(req.user.organizationId);
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/insights/rules/:id */
router.get('/rules/:id', requireTabRead('insights'), async (req, res) => {
  try {
    const rule = await getInsightRuleById(req.user.organizationId, req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json({ rule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/insights/rules */
router.post('/rules', requireTabWrite('insights'), async (req, res) => {
  try {
    const rule = await createCustomInsightRule(req.user.organizationId, req.user._id, req.body);
    res.status(201).json({ rule });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/** PUT /api/insights/rules/:id */
router.put('/rules/:id', requireTabWrite('insights'), async (req, res) => {
  try {
    const rule = await updateInsightRule(req.user.organizationId, req.user._id, req.params.id, req.body);
    res.json({ rule });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/** POST /api/insights/rules/:id/reset */
router.post('/rules/:id/reset', requireTabWrite('insights'), async (req, res) => {
  try {
    const rule = await resetInsightRule(req.user.organizationId, req.user._id, req.params.id);
    res.json({ rule });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/** DELETE /api/insights/rules/:id */
router.delete('/rules/:id', requireTabWrite('insights'), async (req, res) => {
  try {
    const result = await deleteInsightRule(req.user.organizationId, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/** GET /api/insights/dashboard — evaluated insights for dashboard */
router.get('/dashboard', requireTabRead('insights'), async (req, res) => {
  try {
    const data = await evaluateInsights(req.user.organizationId);
    res.json(data);
  } catch (err) {
    console.error('Insights evaluation error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
