import {
  Asset,
  Issue,
  AuditLog,
  AssetLog,
  Organization,
  User,
} from '../models/index.js';
import {
  assetFilterForUser,
  issueFilterForUser,
  getDepartmentScopeId,
  resolveScopedAssetIds,
} from './permissions.js';
import { getKpiSummary } from './kpiSummaryService.js';
import { calculateOrganizationMetrics } from './depreciationService.js';
import { isActiveAssetStatus } from '../constants/assetStatuses.js';
import { getOrganizationSubscriptionStatus } from './organizationSubscriptionService.js';

const OVERDUE_MS = 2 * 24 * 60 * 60 * 1000;

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

function applyWidgetFilters(assets, filters = {}) {
  const f = filters;
  return assets.filter((a) => {
    if (f.departmentId && String(a.departmentId) !== String(f.departmentId)) return false;
    if (f.locationId && String(a.locationId) !== String(f.locationId)) return false;
    if (f.groupId && String(a.groupId) !== String(f.groupId)) return false;
    if (f.templateId && String(a.templateId) !== String(f.templateId)) return false;
    if (f.vendorId && String(a.vendorId) !== String(f.vendorId)) return false;
    if (f.status && a.status !== f.status) return false;
    if (f.category && a.category !== f.category) return false;
    if (f.condition && a.condition !== f.condition) return false;
    if (f.assignedUserId && String(a.assignedToId) !== String(f.assignedUserId)) return false;
    if (f.purchaseYear && String(a.purchaseYear ?? '') !== f.purchaseYear) return false;
    if (f.warrantyStatus && a.warrantyStatus !== f.warrantyStatus) return false;
    if (f.dateFrom && a.purchaseDate && new Date(a.purchaseDate) < new Date(f.dateFrom)) return false;
    if (f.dateTo && a.purchaseDate) {
      const end = new Date(f.dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(a.purchaseDate) > end) return false;
    }
    return true;
  });
}

function activityLabel(type) {
  const map = {
    asset_added: 'Asset added',
    asset_moved: 'Asset moved',
    issue_reported: 'Issue reported',
    maintenance_completed: 'Maintenance completed',
    warranty_updated: 'Warranty updated',
    asset_assigned: 'Asset assigned',
    audit_completed: 'Audit completed',
  };
  return map[type] || 'Activity';
}

function mapAuditActivity(log) {
  if (log.resource === 'asset' && log.action === 'created') {
    return { type: 'asset_added', label: activityLabel('asset_added'), description: log.description || log.resourceName || 'New asset', at: log.createdAt, userName: log.userId?.name };
  }
  if (log.resource === 'asset' && log.action === 'assigned') {
    return { type: 'asset_assigned', label: activityLabel('asset_assigned'), description: log.description || 'Asset assigned', at: log.createdAt, userName: log.userId?.name };
  }
  if (log.resource === 'asset' && log.action === 'updated' && log.description?.toLowerCase().includes('location')) {
    return { type: 'asset_moved', label: activityLabel('asset_moved'), description: log.description, at: log.createdAt, userName: log.userId?.name };
  }
  if (log.resource === 'issue' && log.action === 'created') {
    return { type: 'issue_reported', label: activityLabel('issue_reported'), description: log.description || log.resourceName || 'Issue reported', at: log.createdAt, userName: log.userId?.name };
  }
  if (log.resource === 'issue' && (log.action === 'resolved' || log.details?.newStatus === 'completed')) {
    return { type: 'maintenance_completed', label: activityLabel('maintenance_completed'), description: log.description || 'Issue resolved', at: log.createdAt, userName: log.userId?.name };
  }
  if (log.resource === 'asset' && log.description?.toLowerCase().includes('warranty')) {
    return { type: 'warranty_updated', label: activityLabel('warranty_updated'), description: log.description, at: log.createdAt, userName: log.userId?.name };
  }
  if (log.resource === 'audit' || log.action === 'audit') {
    return { type: 'audit_completed', label: activityLabel('audit_completed'), description: log.description || 'Audit event', at: log.createdAt, userName: log.userId?.name };
  }
  return null;
}

function mapAssetLogActivity(log) {
  const created = log.fieldChanges?.find((c) => c.field === 'created' || c.label === 'Created');
  if (created) {
    return { type: 'asset_added', label: activityLabel('asset_added'), description: `Added ${created.newValue}`, at: log.createdAt };
  }
  const assigned = log.fieldChanges?.find((c) => c.field === 'assignedTo');
  if (assigned) {
    return { type: 'asset_assigned', label: activityLabel('asset_assigned'), description: `Assigned to ${assigned.newValue}`, at: log.createdAt };
  }
  const location = log.fieldChanges?.find((c) => c.field === 'locationId' || c.label?.toLowerCase().includes('location'));
  if (location) {
    return { type: 'asset_moved', label: activityLabel('asset_moved'), description: `Location: ${location.newValue}`, at: log.createdAt };
  }
  const warranty = log.fieldChanges?.find((c) => c.field === 'warrantyExpiry' || c.label?.toLowerCase().includes('warranty'));
  if (warranty) {
    return { type: 'warranty_updated', label: activityLabel('warranty_updated'), description: 'Warranty updated', at: log.createdAt };
  }
  return null;
}

function bucketCount(assets, keyFn) {
  const map = new Map();
  for (const a of assets) {
    const key = keyFn(a);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export { filtersFromQuery };

export async function getHomeDashboardData(user, query = {}) {
  const pageFilters = filtersFromQuery(query);
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const overdueCutoff = new Date(Date.now() - OVERDUE_MS);

  const assetFilter = assetFilterForUser(user) || { _id: { $exists: false } };
  let deptAssetIds = null;
  const deptScope = getDepartmentScopeId(user);
  if (deptScope || (user.assignedLocationIds?.length && user.role === 'lab_technician')) {
    deptAssetIds = await resolveScopedAssetIds(user);
  }
  const issueFilter = issueFilterForUser(user, deptAssetIds) || { _id: { $exists: false } };

  const [kpi, metricsResult, org, userCount, auditLogs, assetIds, resolvedIssues] = await Promise.all([
    getKpiSummary(user.organizationId, user._id, pageFilters),
    calculateOrganizationMetrics(user.organizationId, user._id, pageFilters),
    Organization.findById(user.organizationId).lean(),
    User.countDocuments({ organizationId: user.organizationId, isActive: true }),
    AuditLog.find({ organizationId: user.organizationId, createdAt: { $gte: thirtyDaysAgo } })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Asset.find(assetFilter).select('_id').lean(),
    Issue.find({ ...issueFilter, status: 'completed', resolvedAt: { $ne: null } })
      .select('createdAt resolvedAt')
      .sort({ resolvedAt: -1 })
      .limit(200)
      .lean(),
  ]);

  const subscription = getOrganizationSubscriptionStatus(org);
  const depreciationEnabled = ['pro', 'premium'].includes(subscription.tier) && !subscription.isExpired;

  const assets = kpi.assets;
  const totals = {
    totalAssets: assets.length,
    activeAssets: assets.filter((a) => isActiveAssetStatus(a.status)).length,
    underMaintenance: assets.filter((a) => ['under_maintenance', 'needs_repair'].includes(a.status)).length,
    warrantyExpiring30: assets.filter((a) => a.warrantyStatus === 'expiring').length,
    replacementRequired: assets.filter((a) => a.replacementScore >= 75).length,
    unassigned: assets.filter((a) => !a.isAssigned).length,
    lowHealth: assets.filter((a) => a.healthScore < 50).length,
  };

  const [
    overdueMaintenance,
    warrantyExpiring7,
    recentAssets,
    assetLogs,
    latestIssues,
  ] = await Promise.all([
    Asset.countDocuments({
      ...assetFilter,
      status: 'under_maintenance',
      maintenanceStartDate: { $exists: true, $ne: null, $lte: overdueCutoff },
    }),
    Asset.countDocuments({
      ...assetFilter,
      warrantyExpiry: { $gte: now, $lte: in7 },
    }),
    Asset.find(assetFilter)
      .sort({ createdAt: -1 })
      .limit(20)
      .select('name assetId status category createdAt')
      .lean(),
    AssetLog.find({
      assetId: { $in: assetIds.map((a) => a._id) },
      createdAt: { $gte: thirtyDaysAgo },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
    Issue.find(issueFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('assetId', 'name assetId')
      .lean(),
  ]);

  const attention = [
    { key: 'overdue_maintenance', icon: '🔧', label: 'Overdue maintenance', count: overdueMaintenance, href: '/dashboard/maintenance' },
    { key: 'warranty_expiring', icon: '📅', label: 'Warranties expiring soon', count: totals.warrantyExpiring30, href: '/dashboard/assets' },
    { key: 'unassigned', icon: '📍', label: 'Unassigned assets', count: totals.unassigned, href: '/dashboard/assets' },
    { key: 'low_health', icon: '⚠️', label: 'Low health assets', count: totals.lowHealth, href: '/dashboard/asset-health' },
  ].filter((i) => i.count > 0);

  const activity = [
    ...auditLogs.map(mapAuditActivity).filter(Boolean),
    ...assetLogs.map(mapAssetLogActivity).filter(Boolean),
    ...latestIssues.map((i) => ({
      type: 'issue_reported',
      label: activityLabel('issue_reported'),
      description: i.title,
      at: i.createdAt,
      userName: i.reporterName,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);

  const warranty = {
    active: assets.filter((a) => a.warrantyStatus === 'active').length,
    expiring: assets.filter((a) => a.warrantyStatus === 'expiring').length,
    expired: assets.filter((a) => a.warrantyStatus === 'expired').length,
  };

  const financial = {
    enabled: depreciationEnabled,
    purchaseValue: metricsResult.summary.totalPurchaseValue || 0,
    bookValue: metricsResult.summary.currentBookValue || 0,
    depreciation: metricsResult.summary.totalDepreciation || 0,
  };

  let avgResolutionHours = 0;
  if (resolvedIssues.length) {
    const totalH = resolvedIssues.reduce((s, i) => {
      const hrs = (new Date(i.resolvedAt).getTime() - new Date(i.createdAt).getTime()) / 3600000;
      return s + (hrs > 0 ? hrs : 0);
    }, 0);
    avgResolutionHours = Math.round((totalH / resolvedIssues.length) * 10) / 10;
  }

  const performance = {
    avgResolutionHours,
    utilizationPct: kpi.totals.utilizationPct,
    avgHealthScore: assets.length
      ? Math.round(assets.reduce((s, a) => s + a.healthScore, 0) / assets.length)
      : 0,
  };

  const notifications = [];
  if (warrantyExpiring7 > 0) {
    notifications.push({ type: 'warranty', message: `${warrantyExpiring7} warrant${warrantyExpiring7 === 1 ? 'y' : 'ies'} expire in 7 days`, href: '/dashboard/assets' });
  }
  if (overdueMaintenance > 0) {
    notifications.push({ type: 'maintenance', message: `${overdueMaintenance} maintenance overdue`, href: '/dashboard/maintenance' });
  }
  if (subscription.daysRemaining != null && subscription.daysRemaining <= 14 && subscription.tier !== 'free') {
    notifications.push({ type: 'subscription', message: `Subscription expires in ${subscription.daysRemaining} days`, href: '/dashboard/subscriptions' });
  }

  const distributions = {
    byGroup: bucketCount(assets, (a) => a.groupName || 'Ungrouped'),
    byStatus: bucketCount(assets, (a) => (a.status || 'unknown').replace(/_/g, ' ')),
    byLocation: bucketCount(assets, (a) => a.location || 'Unassigned'),
  };

  return {
    assets,
    totals,
    attention,
    activity,
    warranty,
    financial,
    performance,
    notifications,
    distributions,
    latestAssets: recentAssets.map((a) => ({
      id: String(a._id),
      name: a.name,
      assetIdString: a.assetId,
      status: a.status,
      category: a.category,
      createdAt: a.createdAt,
    })),
    system: {
      tier: subscription.tier,
      plan: subscription.plan,
      daysRemaining: subscription.daysRemaining,
      isExpired: subscription.isExpired,
      assetCount: totals.totalAssets,
      assetLimit: subscription.limits.assets,
      userCount,
      userLimit: subscription.limits.users,
    },
    depreciationEnabled,
    kpiTotals: kpi.totals,
    quick: kpi.quick,
    pageFilters,
  };
}

export function filterAssetsForWidget(ctx, widgetFilters) {
  return applyWidgetFilters(ctx.assets, widgetFilters);
}
