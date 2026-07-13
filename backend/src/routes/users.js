import express from 'express';
import bcrypt from 'bcryptjs';
import { User, Organization } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canManageUsers, canReadRoles } from '../services/permissions.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';
import { getDefaultAssetsListPreferences } from '../constants/assetsListPreferences.js';
import { getDefaultDepreciationDashboard } from '../constants/depreciationDashboardDefaults.js';

const router = express.Router();
router.use(protect);

/** Current user's assets list table preferences (columns, views, filters, sort) */
router.get('/me/preferences/assets-list', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences').lean();
    const prefs = user?.preferences?.assetsList;
    res.json({ preferences: prefs || getDefaultAssetsListPreferences() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me/preferences/assets-list', async (req, res) => {
  try {
    const incoming = req.body?.preferences ?? req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ message: 'Invalid preferences payload' });
    }
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'preferences.assetsList': incoming },
    });
    res.json({ preferences: incoming });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me/preferences/depreciation-dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences').lean();
    const layout = user?.preferences?.depreciationDashboard;
    res.json({ layout: layout || getDefaultDepreciationDashboard() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me/preferences/depreciation-dashboard', async (req, res) => {
  try {
    const incoming = req.body?.layout ?? req.body;
    if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.widgets)) {
      return res.status(400).json({ message: 'Invalid layout payload' });
    }
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'preferences.depreciationDashboard': incoming },
    });
    res.json({ layout: incoming });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me/preferences/kpi-dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences').lean();
    const prefs = user?.preferences?.kpiDashboard || {};
    res.json({ activeDashboardId: prefs.activeDashboardId || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me/preferences/kpi-dashboard', async (req, res) => {
  try {
    const { activeDashboardId } = req.body || {};
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'preferences.kpiDashboard': { activeDashboardId: activeDashboardId || null } },
    });
    res.json({ activeDashboardId: activeDashboardId || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me/preferences/home-dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences').lean();
    const prefs = user?.preferences?.homeDashboard || {};
    res.json({ activeDashboardId: prefs.activeDashboardId || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me/preferences/home-dashboard', async (req, res) => {
  try {
    const { activeDashboardId } = req.body || {};
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'preferences.homeDashboard': { activeDashboardId: activeDashboardId || null } },
    });
    res.json({ activeDashboardId: activeDashboardId || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me/preferences/budget-dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences').lean();
    const prefs = user?.preferences?.budgetDashboard || {};
    res.json({ activeDashboardId: prefs.activeDashboardId || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me/preferences/budget-dashboard', async (req, res) => {
  try {
    const { activeDashboardId } = req.body || {};
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'preferences.budgetDashboard': { activeDashboardId: activeDashboardId || null } },
    });
    res.json({ activeDashboardId: activeDashboardId || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me/preferences/budget-module-filters', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences.budgetModuleFilters').lean();
    res.json({ filters: user?.preferences?.budgetModuleFilters || {} });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me/preferences/budget-module-filters', async (req, res) => {
  try {
    const { filters } = req.body || {};
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'preferences.budgetModuleFilters': filters && typeof filters === 'object' ? filters : {} },
    });
    res.json({ filters: filters || {} });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** List users — super_admin sees all in org, others with roles tab read access */
router.get('/', async (req, res) => {
  try {
    if (!canReadRoles(req.user, req) && !canManageUsers(req.user, req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const filter = { isActive: true, organizationId: req.user.organizationId };
    const users = await User.find(filter)
      .select('_id name email role customRoleId departmentId assignedLocationIds isActive organizationId')
      .populate('departmentId', 'name')
      .populate('customRoleId', 'name')
      .populate('assignedLocationIds', 'name type code')
      .sort({ name: 1 })
      .lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Create user — super_admin only */
router.post('/', async (req, res) => {
  try {
    if (!canManageUsers(req.user, req)) {
      return res.status(403).json({ message: 'Only users with write access can add users' });
    }

    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    const now = new Date();
    const isExpired = org.subscriptionEndDate && org.subscriptionEndDate < now;

    const TIER_LIMITS = {
      free: 5,
      pro: 10,
      premium: 20,
    };

    const tier = isExpired ? 'free' : (org.subscriptionTier || 'free');
    const limit = TIER_LIMITS[tier] || 5;
    const userCount = await User.countDocuments({
      organizationId: req.user.organizationId,
      isActive: true,
    });

    if (userCount >= limit) {
      const message = isExpired
        ? 'Subscription expired. Renew to add more users.'
        : `User limit reached for ${tier} plan (${limit} users). Upgrade to add more.`;
      return res.status(403).json({ message });
    }

    const { email, name, password, customRoleId, departmentId, assignedLocationIds } = req.body;
    if (!email || !name || !password || !customRoleId) {
      return res.status(400).json({ message: 'Email, name, password, and role are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const { OrgRole } = await import('../models/index.js');
    const orgRole = await OrgRole.findOne({
      _id: customRoleId,
      organizationId: req.user.organizationId,
      isActive: true,
    });
    if (!orgRole) return res.status(400).json({ message: 'Invalid role selected' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name: name.trim(),
      role: 'custom',
      customRoleId: orgRole._id,
      organizationId: req.user.organizationId,
      departmentId: departmentId || undefined,
      assignedLocationIds: Array.isArray(assignedLocationIds) ? assignedLocationIds : undefined,
      emailVerified: true,
    });
    const populated = await User.findById(user._id)
      .select('_id name email role customRoleId departmentId assignedLocationIds isActive organizationId')
      .populate('departmentId', 'name')
      .populate('customRoleId', 'name')
      .populate('assignedLocationIds', 'name type code')
      .lean();
    await logAudit(req.user._id, AUDIT_ACTIONS.USER_CREATED, AUDIT_RESOURCES.USER, user._id, {
      resourceName: name.trim(),
      description: `Created user "${name.trim()}" with role ${orgRole.name}`,
      severity: 'medium',
      ...getRequestMetadata(req),
    });
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Update user — super_admin only */
router.patch('/:id', async (req, res) => {
  try {
    if (!canManageUsers(req.user, req)) {
      return res.status(403).json({ message: 'Only Super Admin can update users' });
    }
    const { name, customRoleId, departmentId, assignedLocationIds, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (customRoleId !== undefined) {
      const { OrgRole } = await import('../models/index.js');
      const orgRole = await OrgRole.findOne({
        _id: customRoleId,
        organizationId: req.user.organizationId,
        isActive: true,
      });
      if (!orgRole) return res.status(400).json({ message: 'Invalid role selected' });
      update.customRoleId = orgRole._id;
      update.role = 'custom';
    }
    if (departmentId !== undefined) update.departmentId = departmentId || null;
    if (assignedLocationIds !== undefined) {
      update.assignedLocationIds = Array.isArray(assignedLocationIds) ? assignedLocationIds : [];
    }
    if (isActive !== undefined) update.isActive = !!isActive;

    const existing = await User.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'User not found' });
    if (existing.role === 'super_admin' && customRoleId !== undefined) {
      return res.status(400).json({ message: 'Cannot change the super admin role' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('_id name email role customRoleId departmentId assignedLocationIds isActive organizationId')
      .populate('departmentId', 'name')
      .populate('customRoleId', 'name')
      .populate('assignedLocationIds', 'name type code')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    await logAudit(req.user._id, AUDIT_ACTIONS.USER_UPDATED, AUDIT_RESOURCES.USER, user._id, {
      resourceName: user.name,
      description: `Updated user "${user.name}"`,
      severity: 'medium',
      ...getRequestMetadata(req),
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Delete user — super_admin only */
router.delete('/:id', async (req, res) => {
  try {
    if (!canManageUsers(req.user, req)) {
      return res.status(403).json({ message: 'Only Super Admin can delete users' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    if (user.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    await logAudit(req.user._id, AUDIT_ACTIONS.USER_DELETED, AUDIT_RESOURCES.USER, user._id, {
      resourceName: user.name,
      description: `Deactivated user "${user.name}" (${user.email})`,
      severity: 'high',
      ...getRequestMetadata(req),
    });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
