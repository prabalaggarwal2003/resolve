import express from 'express';
import { protect } from '../middleware/auth.js';
import { canRead, canWrite } from '../services/permissions.js';
import {
  getBudgetOrgConfig,
  updateBudgetOrgConfig,
  ensureBudgetOrgConfig,
} from '../services/budgetOrgConfigService.js';
import {
  listBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetHistory,
  getBudgetSummary,
  listOrganizationBudgetHistory,
} from '../services/budgetService.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';
import { buildBudgetOrgConfigChanges } from '../services/moduleConfigAudit.js';
import { changesToAuditPayload } from '../services/budgetChangeLog.js';

const router = express.Router();

router.use(protect);

function requireBudgetRead(req, res, next) {
  if (!canRead(req.user, 'budgets', req)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

function requireBudgetWrite(req, res, next) {
  if (!canWrite(req.user, 'budgets', req)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

/** GET /api/budgets/config — organization budget module settings */
router.get('/config', requireBudgetRead, async (req, res) => {
  try {
    const config = await getBudgetOrgConfig(req.user.organizationId);
    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** PUT /api/budgets/config */
router.put('/config', requireBudgetWrite, async (req, res) => {
  try {
    const before = (await getBudgetOrgConfig(req.user.organizationId)).toObject();
    const config = await updateBudgetOrgConfig(
      req.user.organizationId,
      req.user._id,
      req.body
    );
    const after = config.toObject();
    const { budgetPayload, procurementPayload } = buildBudgetOrgConfigChanges(before, after);

    if (budgetPayload) {
      await logAudit(
        req.user._id,
        AUDIT_ACTIONS.BUDGET_CONFIG_UPDATED,
        AUDIT_RESOURCES.BUDGET,
        req.user.organizationId,
        {
          resourceName: 'Budget module settings',
          description: budgetPayload.summary,
          details: budgetPayload,
          severity: 'low',
          ...getRequestMetadata(req),
        }
      );
    }
    if (procurementPayload) {
      await logAudit(
        req.user._id,
        AUDIT_ACTIONS.PROCUREMENT_CONFIG_UPDATED,
        AUDIT_RESOURCES.PROCUREMENT,
        req.user.organizationId,
        {
          resourceName: 'Procurement module settings',
          description: procurementPayload.summary,
          details: procurementPayload,
          severity: 'low',
          ...getRequestMetadata(req),
        }
      );
    }

    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/budgets/summary — dashboard KPI totals */
router.get('/summary', requireBudgetRead, async (req, res) => {
  try {
    await ensureBudgetOrgConfig(req.user.organizationId);
    const summary = await getBudgetSummary(req.user.organizationId);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/budgets/history — organization-wide budget history */
router.get('/history', requireBudgetRead, async (req, res) => {
  try {
    const filters = { ...req.query };
    const history = await listOrganizationBudgetHistory(req.user.organizationId, filters);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/budgets */
router.get('/', requireBudgetRead, async (req, res) => {
  try {
    const filters = { ...req.query };
    const budgets = await listBudgets(req.user.organizationId, filters);
    res.json({ budgets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/budgets/:id */
router.get('/:id', requireBudgetRead, async (req, res) => {
  try {
    const budget = await getBudgetById(req.user.organizationId, req.params.id);
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    res.json({ budget });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/budgets/:id/history */
router.get('/:id/history', requireBudgetRead, async (req, res) => {
  try {
    const budget = await getBudgetById(req.user.organizationId, req.params.id);
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    const history = await getBudgetHistory(req.user.organizationId, req.params.id);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/budgets */
router.post('/', requireBudgetWrite, async (req, res) => {
  try {
    if (!req.body.name?.trim()) {
      return res.status(400).json({ message: 'Budget name is required' });
    }
    const budget = await createBudget(req.user.organizationId, req.user, req.body);
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.BUDGET_CREATED,
      AUDIT_RESOURCES.BUDGET,
      budget._id,
      {
        resourceName: budget.name,
        description: `Created budget "${budget.name}"`,
        severity: 'medium',
        ...getRequestMetadata(req),
      }
    );
    res.status(201).json({ budget });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/** PUT /api/budgets/:id */
router.put('/:id', requireBudgetWrite, async (req, res) => {
  try {
    const { budget, changes } = await updateBudget(req.user.organizationId, req.user, req.params.id, req.body);
    const auditPayload = changes?.length ? changesToAuditPayload(changes) : null;
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.BUDGET_UPDATED,
      AUDIT_RESOURCES.BUDGET,
      budget._id,
      {
        resourceName: budget.name,
        description: auditPayload?.summary || `Updated budget "${budget.name}"`,
        details: auditPayload || undefined,
        severity: 'medium',
        ...getRequestMetadata(req),
      }
    );
    res.json({ budget, changes: changes || [] });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/** DELETE /api/budgets/:id */
router.delete('/:id', requireBudgetWrite, async (req, res) => {
  try {
    const budget = await deleteBudget(req.user.organizationId, req.params.id);
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.BUDGET_DELETED,
      AUDIT_RESOURCES.BUDGET,
      budget._id,
      {
        resourceName: budget.name,
        description: `Deleted budget "${budget.name}"`,
        severity: 'high',
        ...getRequestMetadata(req),
      }
    );
    res.json({ message: 'Budget deleted' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

export default router;
