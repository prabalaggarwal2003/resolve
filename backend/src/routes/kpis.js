import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireTabRead } from '../middleware/tabPermissions.js';
import { getOrganizationKPIs } from '../services/kpiService.js';
import { getKpiSummary } from '../services/kpiSummaryService.js';
import KpiDashboard from '../models/KpiDashboard.js';
import { getDefaultKpiDashboardLayout } from '../constants/kpiDashboardDefaults.js';

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
    'departmentId', 'locationId', 'groupId', 'templateId', 'vendorId', 'status',
    'category', 'purchaseYear', 'warrantyStatus', 'condition', 'assignedUserId',
    'dateFrom', 'dateTo',
  ];
  const filters = {};
  for (const k of keys) {
    if (query[k]) filters[k] = query[k];
  }
  return filters;
}

router.get('/', requireTabRead('kpis'), async (req, res) => {
  try {
    const kpis = await getOrganizationKPIs(req.user.organizationId);
    res.json(kpis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/summary', requireTabRead('kpis'), async (req, res) => {
  try {
    const filters = filtersFromQuery(req.query);
    const data = await getKpiSummary(req.user.organizationId, req.user._id, filters, req.user);
    res.json(data);
  } catch (error) {
    console.error('KPI summary error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/dashboards', requireTabRead('kpis'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const dashboards = await KpiDashboard.find({
      organizationId: orgId,
      $or: [
        { scope: 'organization' },
        { scope: 'personal', ownerId: req.user._id },
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();

    const visible = dashboards.filter((d) => canAccessDashboard(d, req.user));
    res.json({ dashboards: visible });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/dashboards', requireTabRead('kpis'), async (req, res) => {
  try {
    const { name, description, scope, templateId, layout, autoRefresh, allowedRoleIds } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

    const dashboard = await KpiDashboard.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description: description || '',
      scope: scope === 'organization' ? 'organization' : 'personal',
      ownerId: req.user._id,
      templateId: templateId || null,
      layout: layout || getDefaultKpiDashboardLayout(),
      autoRefresh: autoRefresh || 'manual',
      allowedRoleIds: allowedRoleIds || [],
    });
    res.status(201).json({ dashboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/dashboards/:id', requireTabRead('kpis'), async (req, res) => {
  try {
    const dashboard = await KpiDashboard.findById(req.params.id).lean();
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/dashboards/:id', requireTabRead('kpis'), async (req, res) => {
  try {
    const dashboard = await KpiDashboard.findById(req.params.id);
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
    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/dashboards/:id', requireTabRead('kpis'), async (req, res) => {
  try {
    const dashboard = await KpiDashboard.findById(req.params.id);
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    if (dashboard.scope === 'organization' && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admins can delete organization dashboards' });
    }
    await dashboard.deleteOne();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/dashboards/:id/duplicate', requireTabRead('kpis'), async (req, res) => {
  try {
    const source = await KpiDashboard.findById(req.params.id).lean();
    if (!canAccessDashboard(source, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    const copy = await KpiDashboard.create({
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
    res.status(201).json({ dashboard: copy });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
