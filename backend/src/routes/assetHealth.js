import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireTabRead } from '../middleware/tabPermissions.js';
import { Asset } from '../models/index.js';
import AssetHealthDashboard from '../models/AssetHealthDashboard.js';
import {
  checkAssetHealth,
  runOrganizationHealthCheck,
  getAssetHealthSummary,
  getAssetsUnderMaintenance,
  checkOverdueMaintenanceAlerts,
  sendMaintenanceNotification,
  ASSET_CONDITIONS,
} from '../services/assetHealthService.js';
import {
  getAssetHealthOrgConfig,
  updateAssetHealthOrgConfig,
  listAssetHealthProfiles,
  createAssetHealthProfile,
  updateAssetHealthProfile,
  deleteAssetHealthProfile,
  resetAutomationRule,
  getAssetHealthProfile,
} from '../services/assetHealthOrgConfigService.js';
import {
  getAssetHealthSummaryData,
  getHealthTrend,
  previewHealthScore,
  recordHealthSnapshot,
} from '../services/assetHealthSummaryService.js';
import { getDefaultHealthDashboardLayout } from '../constants/assetHealthDefaults.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';
import {
  buildAssetHealthOrgConfigChanges,
  buildAssetHealthProfileChanges,
  buildAssetHealthRuleResetChanges,
} from '../services/moduleConfigAudit.js';
import { getDepartmentScopeId } from '../services/permissions.js';

const router = express.Router();
router.use(protect);

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
}

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
    'category', 'purchaseYear', 'condition', 'assignedUserId',
  ];
  const filters = {};
  for (const k of keys) {
    if (query[k]) filters[k] = query[k];
  }
  return filters;
}

router.get('/summary', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const summary = await getAssetHealthSummary(req.user.organizationId);
    const config = await getAssetHealthOrgConfig(req.user.organizationId);
    res.json({
      summary,
      config: {
        factors: config.factors,
        healthLevels: config.healthLevels,
        autoUpdateCondition: config.autoUpdateCondition,
      },
      conditions: ASSET_CONDITIONS,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/data', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const filters = filtersFromQuery(req.query);
    const data = await getAssetHealthSummaryData(req.user.organizationId, filters);
    await recordHealthSnapshot(req.user.organizationId);
    const trend = await getHealthTrend(req.user.organizationId, Number(req.query.trendDays) || 30);
    res.json({ ...data, trend });
  } catch (error) {
    console.error('Asset health data error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/trend', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const trend = await getHealthTrend(req.user.organizationId, Number(req.query.days) || 30);
    res.json({ trend });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/config', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const config = await getAssetHealthOrgConfig(req.user.organizationId);
    res.json({ config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/config', requireTabRead('assetHealth'), requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const before = await getAssetHealthOrgConfig(req.user.organizationId);
    const config = await updateAssetHealthOrgConfig(req.user.organizationId, req.user._id, req.body);
    const changePayload = buildAssetHealthOrgConfigChanges(before, config);
    if (changePayload) {
      await logAudit(
        req.user._id,
        AUDIT_ACTIONS.ASSET_HEALTH_CONFIG_UPDATED,
        AUDIT_RESOURCES.ASSET_HEALTH,
        req.user.organizationId,
        {
          resourceName: 'Asset health settings',
          description: changePayload.summary,
          details: changePayload,
          severity: 'medium',
          ...getRequestMetadata(req),
        }
      );
    }
    res.json({ config });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/config/preview', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const preview = await previewHealthScore(req.user.organizationId, req.body);
    res.json({ preview });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/config/rules/:ruleKey/reset', requireTabRead('assetHealth'), requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const beforeConfig = await getAssetHealthOrgConfig(req.user.organizationId);
    const beforeRule = (beforeConfig.automationRules || []).find((r) => r.ruleKey === req.params.ruleKey);
    const config = await resetAutomationRule(req.user.organizationId, req.user._id, req.params.ruleKey);
    const afterRule = (config.automationRules || []).find((r) => r.ruleKey === req.params.ruleKey);
    const changePayload = buildAssetHealthRuleResetChanges(req.params.ruleKey, beforeRule, afterRule);
    if (changePayload) {
      await logAudit(
        req.user._id,
        AUDIT_ACTIONS.ASSET_HEALTH_RULE_RESET,
        AUDIT_RESOURCES.ASSET_HEALTH,
        req.user.organizationId,
        {
          resourceName: req.params.ruleKey,
          description: changePayload.summary,
          details: changePayload,
          severity: 'low',
          ...getRequestMetadata(req),
        }
      );
    }
    res.json({ config });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/profiles', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const profiles = await listAssetHealthProfiles(req.user.organizationId);
    res.json({ profiles });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/profiles', requireTabRead('assetHealth'), requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const profile = await createAssetHealthProfile(req.user.organizationId, req.user._id, req.body);
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.ASSET_HEALTH_PROFILE_CREATED,
      AUDIT_RESOURCES.ASSET_HEALTH,
      profile._id,
      {
        resourceName: profile.name,
        description: `Created asset health profile "${profile.name}"`,
        severity: 'medium',
        ...getRequestMetadata(req),
      }
    );
    res.status(201).json({ profile });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/profiles/:id', requireTabRead('assetHealth'), requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const before = await getAssetHealthProfile(req.user.organizationId, req.params.id);
    if (!before) return res.status(404).json({ message: 'Health profile not found' });
    const profile = await updateAssetHealthProfile(req.user.organizationId, req.user._id, req.params.id, req.body);
    const changePayload = buildAssetHealthProfileChanges(before, profile);
    if (changePayload) {
      await logAudit(
        req.user._id,
        AUDIT_ACTIONS.ASSET_HEALTH_PROFILE_UPDATED,
        AUDIT_RESOURCES.ASSET_HEALTH,
        profile._id,
        {
          resourceName: profile.name,
          description: changePayload.summary,
          details: changePayload,
          severity: 'medium',
          ...getRequestMetadata(req),
        }
      );
    }
    res.json({ profile });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.delete('/profiles/:id', requireTabRead('assetHealth'), requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const existing = await getAssetHealthProfile(req.user.organizationId, req.params.id);
    if (!existing) return res.status(404).json({ message: 'Health profile not found' });
    await deleteAssetHealthProfile(req.user.organizationId, req.params.id);
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.ASSET_HEALTH_PROFILE_DELETED,
      AUDIT_RESOURCES.ASSET_HEALTH,
      existing._id,
      {
        resourceName: existing.name,
        description: `Deleted asset health profile "${existing.name}"`,
        severity: 'high',
        ...getRequestMetadata(req),
      }
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/dashboards', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const dashboards = await AssetHealthDashboard.find({
      organizationId: orgId,
      $or: [{ scope: 'organization' }, { scope: 'personal', ownerId: req.user._id }],
    })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ dashboards: dashboards.filter((d) => canAccessDashboard(d, req.user)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/dashboards', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const { name, description, scope, templateId, layout, autoRefresh, allowedRoleIds } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    const dashboard = await AssetHealthDashboard.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description: description || '',
      scope: scope === 'organization' ? 'organization' : 'personal',
      ownerId: req.user._id,
      templateId: templateId || null,
      layout: layout || getDefaultHealthDashboardLayout(),
      autoRefresh: autoRefresh || 'manual',
      allowedRoleIds: allowedRoleIds || [],
    });
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.ASSET_HEALTH_DASHBOARD_CREATED,
      AUDIT_RESOURCES.ASSET_HEALTH,
      dashboard._id,
      {
        resourceName: dashboard.name,
        description: `Created asset health dashboard "${dashboard.name}"`,
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

router.get('/dashboards/:id', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const dashboard = await AssetHealthDashboard.findById(req.params.id).lean();
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/dashboards/:id', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const dashboard = await AssetHealthDashboard.findById(req.params.id);
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
      AUDIT_ACTIONS.ASSET_HEALTH_DASHBOARD_UPDATED,
      AUDIT_RESOURCES.ASSET_HEALTH,
      dashboard._id,
      {
        resourceName: dashboard.name,
        description: `Updated asset health dashboard "${dashboard.name}"`,
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

router.delete('/dashboards/:id', requireTabRead('assetHealth'), async (req, res) => {
  try {
    const dashboard = await AssetHealthDashboard.findById(req.params.id);
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    if (dashboard.scope === 'organization' && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admins can delete organization dashboards' });
    }
    const dashboardName = dashboard.name;
    const dashboardId = dashboard._id;
    await dashboard.deleteOne();
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.ASSET_HEALTH_DASHBOARD_DELETED,
      AUDIT_RESOURCES.ASSET_HEALTH,
      dashboardId,
      {
        resourceName: dashboardName,
        description: `Deleted asset health dashboard "${dashboardName}"`,
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

router.get('/maintenance', requireTabRead('maintenance'), async (req, res) => {
  try {
    const deptId = getDepartmentScopeId(req.user) ?? undefined;
    const assets = await getAssetsUnderMaintenance(req.user.organizationId, deptId);
    res.json({ assets, total: assets.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/maintenance/check-overdue', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const result = await checkOverdueMaintenanceAlerts();
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.HEALTH_CHECK_RUN,
      AUDIT_RESOURCES.ASSET_HEALTH,
      req.user.organizationId,
      {
        resourceName: 'Overdue maintenance check',
        description: 'Ran overdue maintenance alert check',
        details: { scope: 'overdue_maintenance', ...result },
        severity: 'low',
        ...getRequestMetadata(req),
      }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/check/:assetId', requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
  try {
    const healthAnalysis = await checkAssetHealth(req.params.assetId, req.user._id);
    if (!healthAnalysis) return res.status(404).json({ message: 'Asset not found' });
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.HEALTH_CHECK_RUN,
      AUDIT_RESOURCES.ASSET_HEALTH,
      req.params.assetId,
      {
        resourceName: String(req.params.assetId),
        description: `Ran health check on asset`,
        details: {
          scope: 'single_asset',
          recommendedCondition: healthAnalysis.recommendedCondition,
          needsUpdate: healthAnalysis.needsUpdate,
        },
        severity: 'low',
        ...getRequestMetadata(req),
      }
    );
    res.json(healthAnalysis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/check-all', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const results = await runOrganizationHealthCheck(req.user.organizationId, req.user._id);
    await recordHealthSnapshot(req.user.organizationId);
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.HEALTH_CHECK_RUN,
      AUDIT_RESOURCES.ASSET_HEALTH,
      req.user.organizationId,
      {
        resourceName: 'Organization health check',
        description: `Ran organization health check on ${results.total} assets`,
        details: { scope: 'organization', ...results },
        severity: 'medium',
        ...getRequestMetadata(req),
      }
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:assetId/maintenance', requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['start', 'complete'].includes(status)) {
      return res.status(400).json({ message: 'Status must be "start" or "complete"' });
    }

    const currentAsset = await Asset.findById(req.params.assetId);
    if (!currentAsset) return res.status(404).json({ message: 'Asset not found' });

    const now = new Date();
    let updateQuery = {};

    if (status === 'start') {
      updateQuery = {
        $set: {
          condition: 'under_maintenance',
          status: 'under_maintenance',
          maintenanceReason: reason || 'Manual maintenance request',
          maintenanceStartDate: now,
          lastHealthCheck: now,
        },
        $push: {
          maintenanceHistory: {
            startDate: now,
            reason: reason || 'Manual maintenance request',
          },
        },
      };
    } else {
      const startDate = currentAsset.maintenanceStartDate;
      const durationMinutes = startDate ? Math.round((now - new Date(startDate)) / 60000) : 0;
      const history = currentAsset.maintenanceHistory || [];
      const lastIdx = history.length - 1;
      const hasOpenEntry = lastIdx >= 0 && !history[lastIdx].endDate;

      const setFields = {
        condition: 'good',
        status: 'available',
        maintenanceReason: null,
        maintenanceStartDate: null,
        maintenanceCompletedDate: now,
        lastHealthCheck: now,
      };

      if (hasOpenEntry) {
        setFields[`maintenanceHistory.${lastIdx}.endDate`] = now;
        setFields[`maintenanceHistory.${lastIdx}.completedBy`] = req.user._id;
        setFields[`maintenanceHistory.${lastIdx}.durationMinutes`] = durationMinutes;
        updateQuery = { $set: setFields };
      } else {
        updateQuery = {
          $set: setFields,
          $push: {
            maintenanceHistory: {
              startDate: startDate || now,
              endDate: now,
              reason: currentAsset.maintenanceReason || 'Maintenance completed',
              completedBy: req.user._id,
              durationMinutes,
            },
          },
        };
      }
    }

    const asset = await Asset.findByIdAndUpdate(req.params.assetId, updateQuery, { new: true });

    if (status === 'start') {
      await sendMaintenanceNotification(asset, reason || 'Manual maintenance request');
    }

    await logAudit(
      req.user._id,
      status === 'start' ? AUDIT_ACTIONS.MAINTENANCE_STARTED : AUDIT_ACTIONS.MAINTENANCE_COMPLETED,
      AUDIT_RESOURCES.ASSET_HEALTH,
      asset._id,
      {
        resourceName: `${asset.assetId} - ${asset.name}`,
        description: `Manual ${status === 'start' ? 'started' : 'completed'} maintenance`,
        details: { maintenanceAction: status, reason, manual: true },
        severity: 'medium',
        ...getRequestMetadata(req),
      }
    );

    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
