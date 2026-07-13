import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireTabRead } from '../middleware/tabPermissions.js';
import BudgetDashboard from '../models/BudgetDashboard.js';
import { getDefaultBudgetDashboardLayout } from '../constants/budgetDashboardDefaults.js';
import { getBudgetAnalyticsSummary } from '../services/budgetSummaryService.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';

const router = express.Router();
router.use(protect);

function canAccessDashboard(dashboard, user) {
  if (!dashboard) return false;
  if (String(dashboard.organizationId) !== String(user.organizationId)) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (dashboard.scope === 'organization') {
    if (!dashboard.allowedRoleIds?.length) return true;
    const roleId = user.customRoleId ? String(user.customRoleId) : null;
    return roleId && dashboard.allowedRoleIds.some((id) => String(id) === roleId);
  }
  return dashboard.ownerId && String(dashboard.ownerId) === String(user._id);
}

function filtersFromQuery(query) {
  const keys = [
    'financialYear', 'status', 'budgetTypeId', 'budgetId', 'departmentId', 'locationId',
    'fundingSourceId', 'budgetOwnerId', 'vendorId', 'project', 'costCenter', 'category',
    'lifecycleStage', 'paymentStatus', 'dateFrom', 'dateTo',
  ];
  const filters = {};
  for (const k of keys) {
    if (query[k]) filters[k] = query[k];
  }
  return filters;
}

router.get('/data', requireTabRead('budgets'), async (req, res) => {
  try {
    const data = await getBudgetAnalyticsSummary(req.user.organizationId, filtersFromQuery(req.query));
    res.json(data);
  } catch (error) {
    console.error('Budget analytics error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/dashboards', requireTabRead('budgets'), async (req, res) => {
  try {
    const dashboards = await BudgetDashboard.find({
      organizationId: req.user.organizationId,
      $or: [
        { scope: 'organization' },
        { scope: 'personal', ownerId: req.user._id },
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ dashboards: dashboards.filter((d) => canAccessDashboard(d, req.user)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/dashboards', requireTabRead('budgets'), async (req, res) => {
  try {
    const { name, description, scope, templateId, layout, autoRefresh, allowedRoleIds } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    const dashboard = await BudgetDashboard.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description: description || '',
      scope: scope === 'organization' ? 'organization' : 'personal',
      ownerId: req.user._id,
      templateId: templateId || null,
      layout: layout || getDefaultBudgetDashboardLayout(),
      autoRefresh: autoRefresh || 'manual',
      allowedRoleIds: allowedRoleIds || [],
    });
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.BUDGET_CREATED,
      AUDIT_RESOURCES.BUDGET,
      dashboard._id,
      {
        resourceName: dashboard.name,
        description: `Created budget dashboard "${dashboard.name}"`,
        details: { entityType: 'dashboard', scope: dashboard.scope },
        severity: 'low',
        ...getRequestMetadata(req),
      }
    );
    res.status(201).json({ dashboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/dashboards/:id', requireTabRead('budgets'), async (req, res) => {
  try {
    const dashboard = await BudgetDashboard.findById(req.params.id).lean();
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/dashboards/:id', requireTabRead('budgets'), async (req, res) => {
  try {
    const dashboard = await BudgetDashboard.findById(req.params.id);
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    const { name, description, layout, autoRefresh, allowedRoleIds, scope } = req.body;
    if (name != null) dashboard.name = name.trim();
    if (description != null) dashboard.description = description;
    if (layout != null) dashboard.layout = layout;
    if (req.body.templateId !== undefined) dashboard.templateId = req.body.templateId || null;
    if (autoRefresh != null) dashboard.autoRefresh = autoRefresh;
    if (allowedRoleIds != null) dashboard.allowedRoleIds = allowedRoleIds;
    if (scope != null && (req.user.role === 'admin' || req.user.role === 'super_admin' || String(dashboard.ownerId) === String(req.user._id))) {
      dashboard.scope = scope === 'organization' ? 'organization' : 'personal';
    }
    await dashboard.save();
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.BUDGET_UPDATED,
      AUDIT_RESOURCES.BUDGET,
      dashboard._id,
      {
        resourceName: dashboard.name,
        description: `Updated budget dashboard "${dashboard.name}"`,
        details: { entityType: 'dashboard' },
        severity: 'low',
        ...getRequestMetadata(req),
      }
    );
    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/dashboards/:id', requireTabRead('budgets'), async (req, res) => {
  try {
    const dashboard = await BudgetDashboard.findById(req.params.id);
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    if (dashboard.scope === 'organization' && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admins can delete organization dashboards' });
    }
    await dashboard.deleteOne();
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.BUDGET_DELETED,
      AUDIT_RESOURCES.BUDGET,
      dashboard._id,
      {
        resourceName: dashboard.name,
        description: `Deleted budget dashboard "${dashboard.name}"`,
        details: { entityType: 'dashboard' },
        severity: 'medium',
        ...getRequestMetadata(req),
      }
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/dashboards/:id/duplicate', requireTabRead('budgets'), async (req, res) => {
  try {
    const source = await BudgetDashboard.findById(req.params.id).lean();
    if (!canAccessDashboard(source, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    const copy = await BudgetDashboard.create({
      organizationId: req.user.organizationId,
      name: req.body.name?.trim() || `${source.name} (copy)`,
      description: source.description,
      scope: 'personal',
      ownerId: req.user._id,
      templateId: source.templateId,
      layout: JSON.parse(JSON.stringify(source.layout)),
      autoRefresh: source.autoRefresh,
      allowedRoleIds: [],
    });
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.BUDGET_CREATED,
      AUDIT_RESOURCES.BUDGET,
      copy._id,
      {
        resourceName: copy.name,
        description: `Duplicated budget dashboard from "${source.name}"`,
        details: { entityType: 'dashboard', sourceDashboardId: String(source._id) },
        severity: 'low',
        ...getRequestMetadata(req),
      }
    );
    res.status(201).json({ dashboard: copy });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
