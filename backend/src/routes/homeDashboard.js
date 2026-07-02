import express from 'express';
import { protect } from '../middleware/auth.js';
import HomeDashboard from '../models/HomeDashboard.js';
import { getDefaultHomeDashboardLayout } from '../constants/homeDashboardDefaults.js';
import { getHomeDashboardData, filtersFromQuery } from '../services/homeDashboardService.js';

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

router.get('/data', async (req, res) => {
  try {
    const data = await getHomeDashboardData(req.user, req.query);
    res.json(data);
  } catch (err) {
    console.error('Home dashboard data error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/dashboards', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const dashboards = await HomeDashboard.find({
      organizationId: orgId,
      $or: [{ scope: 'organization' }, { scope: 'personal', ownerId: req.user._id }],
    })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ dashboards: dashboards.filter((d) => canAccessDashboard(d, req.user)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/dashboards', async (req, res) => {
  try {
    const { name, description, scope, templateId, layout, autoRefresh, theme, roleDefault } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    const dashboard = await HomeDashboard.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description: description || '',
      scope: scope === 'organization' ? 'organization' : 'personal',
      ownerId: req.user._id,
      templateId: templateId || null,
      roleDefault: roleDefault || null,
      layout: layout || getDefaultHomeDashboardLayout(),
      autoRefresh: autoRefresh || 'manual',
      theme: theme === 'compact' ? 'compact' : 'comfortable',
    });
    res.status(201).json({ dashboard });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/dashboards/:id', async (req, res) => {
  try {
    const dashboard = await HomeDashboard.findById(req.params.id).lean();
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    res.json({ dashboard });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/dashboards/:id', async (req, res) => {
  try {
    const dashboard = await HomeDashboard.findById(req.params.id);
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    const { name, description, layout, autoRefresh, theme, scope } = req.body;
    if (name != null) dashboard.name = name.trim();
    if (description != null) dashboard.description = description;
    if (layout != null) dashboard.layout = layout;
    if (req.body.templateId !== undefined) dashboard.templateId = req.body.templateId || null;
    if (autoRefresh != null) dashboard.autoRefresh = autoRefresh;
    if (theme != null) dashboard.theme = theme === 'compact' ? 'compact' : 'comfortable';
    if (scope != null && (req.user.role === 'admin' || req.user.role === 'super_admin' || String(dashboard.ownerId) === String(req.user._id))) {
      dashboard.scope = scope === 'organization' ? 'organization' : 'personal';
    }
    await dashboard.save();
    res.json({ dashboard });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/dashboards/:id', async (req, res) => {
  try {
    const dashboard = await HomeDashboard.findById(req.params.id);
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    if (dashboard.scope === 'organization' && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admins can delete organization dashboards' });
    }
    await dashboard.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/dashboards/:id/duplicate', async (req, res) => {
  try {
    const source = await HomeDashboard.findById(req.params.id).lean();
    if (!canAccessDashboard(source, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    const copy = await HomeDashboard.create({
      organizationId: req.user.organizationId,
      name: req.body.name?.trim() || `${source.name} (copy)`,
      description: source.description,
      scope: 'personal',
      ownerId: req.user._id,
      templateId: source.templateId,
      layout: JSON.parse(JSON.stringify(source.layout)),
      autoRefresh: source.autoRefresh,
      theme: source.theme || 'comfortable',
    });
    res.status(201).json({ dashboard: copy });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export { filtersFromQuery };
export default router;
