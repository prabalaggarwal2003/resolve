import { Asset, Issue, AuditLog, Organization, AssetLog } from '../models/index.js';
import {
  canReportOnly,
  isLabTechnician,
  assetFilterForUser,
  issueFilterForUser,
  getDepartmentScopeId,
  resolveScopedAssetIds,
} from './permissions.js';
import { calculateSLM, getCategoryConfig, calculateAssetAge } from './depreciationService.js';

const OVERDUE_MS = 2 * 24 * 60 * 60 * 1000;

const STATUS_BUCKETS = [
  { key: 'available', label: 'Available', statuses: ['available', 'working'] },
  { key: 'in_use', label: 'In use', statuses: ['in_use'] },
  { key: 'under_maintenance', label: 'Under maintenance', statuses: ['under_maintenance', 'needs_repair'] },
  { key: 'out_of_service', label: 'Out of service', statuses: ['out_of_service'] },
  { key: 'retired', label: 'Retired', statuses: ['retired'] },
];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function sumFinancials(assets) {
  let totalPurchaseValue = 0;
  let currentBookValueSLM = 0;
  let hasCostData = false;

  for (const asset of assets) {
    const cost = asset.cost || 0;
    if (!cost) continue;
    hasCostData = true;
    const config = getCategoryConfig(asset.category);
    const age = calculateAssetAge(asset.purchaseDate);
    const slm = calculateSLM(cost, age, config);
    totalPurchaseValue += slm.purchaseCost;
    currentBookValueSLM += slm.currentBookValue;
  }

  return {
    hasCostData,
    totalPurchaseValue: round2(totalPurchaseValue),
    currentBookValueSLM: round2(currentBookValueSLM),
  };
}

function buildIssueTrend(issuesCreated, issuesResolved) {
  const days = 30;
  const labels = [];
  const reported = [];
  const resolved = [];
  const createdMap = new Map(issuesCreated.map((r) => [r._id, r.count]));
  const resolvedMap = new Map(issuesResolved.map((r) => [r._id, r.count]));

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    reported.push(createdMap.get(key) || 0);
    resolved.push(resolvedMap.get(key) || 0);
  }

  return { labels, reported, resolved };
}

function mapActivityType(log) {
  if (log.resource === 'asset' && log.action === 'created') return 'asset_added';
  if (log.resource === 'asset' && log.action === 'assigned') return 'asset_assigned';
  if (
    log.resource === 'issue' &&
    (log.action === 'resolved' || log.details?.newStatus === 'completed')
  ) {
    return 'issue_closed';
  }
  if (
    log.resource === 'asset' &&
    log.action === 'updated' &&
    (log.details?.changes?.status?.old === 'under_maintenance' ||
      log.details?.oldStatus === 'under_maintenance' ||
      log.description?.toLowerCase().includes('maintenance completed'))
  ) {
    return 'maintenance_completed';
  }
  return null;
}

function mapAssetLogActivity(log) {
  const created = log.fieldChanges?.find((c) => c.field === 'created' || c.label === 'Created');
  if (created) {
    return {
      type: 'asset_added',
      label: activityLabel('asset_added'),
      description: `Added ${created.newValue}`,
      at: log.createdAt,
    };
  }
  const assigned = log.fieldChanges?.find((c) => c.field === 'assignedTo');
  if (assigned && assigned.oldValue === '—') {
    return {
      type: 'asset_assigned',
      label: activityLabel('asset_assigned'),
      description: `Assigned to ${assigned.newValue}`,
      at: log.createdAt,
    };
  }
  return null;
}

function activityLabel(type) {
  const map = {
    asset_added: 'Asset added',
    asset_assigned: 'Asset assigned',
    issue_closed: 'Issue closed',
    maintenance_completed: 'Maintenance completed',
  };
  return map[type] || 'Activity';
}

async function resolveFilters(user) {
  const assetFilter = assetFilterForUser(user) || { _id: { $exists: false } };
  let deptAssetIds = null;
  const deptScope = getDepartmentScopeId(user);
  const locationScoped = isLabTechnician(user) && user.assignedLocationIds?.length;
  if (deptScope || locationScoped) {
    deptAssetIds = await resolveScopedAssetIds(user);
  }

  const issueFilter = issueFilterForUser(user, deptAssetIds) || { _id: { $exists: false } };

  return { assetFilter, issueFilter };
}

export async function getDashboardOverview(user) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const { assetFilter, issueFilter } = await resolveFilters(user);
  const org = await Organization.findById(user.organizationId).lean();
  const isExpired = org?.subscriptionEndDate && org.subscriptionEndDate < now;
  const tier = isExpired ? 'free' : org?.subscriptionTier || 'free';
  const depreciationEnabled = ['pro', 'premium'].includes(tier);

  const overdueCutoff = new Date(Date.now() - OVERDUE_MS);

  const [
    totalAssets,
    openIssues,
    inProgressIssues,
    completedToday,
    underMaintenance,
    expiredWarranties,
    overdueMaintenance,
    statusAgg,
    assetsForFinance,
    issuesCreatedAgg,
    issuesResolvedAgg,
    latestIssues,
    auditLogs,
    assetLogs,
  ] = await Promise.all([
    Asset.countDocuments(assetFilter),
    Issue.countDocuments({ ...issueFilter, status: 'open' }),
    Issue.countDocuments({ ...issueFilter, status: 'in_progress' }),
    Issue.countDocuments({ ...issueFilter, status: 'completed', resolvedAt: { $gte: todayStart } }),
    Asset.countDocuments({ ...assetFilter, status: 'under_maintenance' }),
    Asset.countDocuments({
      ...assetFilter,
      warrantyExpiry: { $exists: true, $ne: null, $lt: now },
    }),
    Asset.countDocuments({
      ...assetFilter,
      status: 'under_maintenance',
      maintenanceStartDate: { $exists: true, $ne: null, $lte: overdueCutoff },
    }),
    Asset.aggregate([{ $match: assetFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Asset.find(assetFilter).select('cost category purchaseDate').lean(),
    Issue.aggregate([
      { $match: { ...issueFilter, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    Issue.aggregate([
      {
        $match: {
          ...issueFilter,
          status: 'completed',
          resolvedAt: { $gte: thirtyDaysAgo, $ne: null },
        },
      },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt' } }, count: { $sum: 1 } } },
    ]),
    Issue.find(issueFilter)
      .populate('assetId', 'name assetId')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    AuditLog.find({
      organizationId: user.organizationId,
      createdAt: { $gte: thirtyDaysAgo },
    })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(40)
      .lean(),
    Asset.find(assetFilter).select('_id').lean().then((assets) =>
      AssetLog.find({
        assetId: { $in: assets.map((a) => a._id) },
        type: 'edit',
        createdAt: { $gte: thirtyDaysAgo },
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
    ),
  ]);

  const statusCounts = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));
  const assetStatus = STATUS_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: bucket.statuses.reduce((sum, st) => sum + (statusCounts[st] || 0), 0),
  })).filter((b) => b.value > 0);

  const financial = sumFinancials(assetsForFinance);
  const issueTrend = buildIssueTrend(issuesCreatedAgg, issuesResolvedAgg);

  const recentActivity = [
    ...auditLogs
      .map((log) => {
        const type = mapActivityType(log);
        if (!type) return null;
        return {
          type,
          label: activityLabel(type),
          description: log.description || log.resourceName || activityLabel(type),
          at: log.createdAt,
        };
      })
      .filter(Boolean),
    ...assetLogs.map(mapAssetLogActivity).filter(Boolean),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);

  const actionRequired = [];
  if (overdueMaintenance > 0) {
    actionRequired.push({
      key: 'overdue_maintenance',
      label: 'Overdue maintenance',
      count: overdueMaintenance,
      href: '/dashboard/maintenance',
    });
  }
  if (expiredWarranties > 0) {
    actionRequired.push({
      key: 'expired_warranties',
      label: 'Expired warranties',
      count: expiredWarranties,
      href: '/dashboard/assets',
    });
  }

  const issues = latestIssues.map((issue) => ({
    _id: issue._id,
    ticketId: issue.ticketId,
    title: issue.title,
    status: issue.status,
    priority: issue.priority || 'medium',
    createdAt: issue.createdAt,
    reporterName: issue.reporterName || issue.reports?.[0]?.reporterName || '—',
    assetName: issue.assetId?.name || '—',
    assetCode: issue.assetId?.assetId,
  }));

  const hasIssueTrend =
    issueTrend.reported.some((n) => n > 0) || issueTrend.resolved.some((n) => n > 0);
  const hasAssetStatus = assetStatus.length > 0;
  const hasFinancial = financial.hasCostData && financial.totalPurchaseValue > 0;
  const hasActivity = recentActivity.length > 0;

  return {
    role: user.role,
    canReportOnly: canReportOnly(user),
    kpis: {
      totalAssets,
      openIssues,
      inProgressIssues,
      resolvedToday: completedToday,
      underMaintenance,
      totalPurchaseValue: hasFinancial ? financial.totalPurchaseValue : null,
      currentBookValueSLM:
        depreciationEnabled && hasFinancial ? financial.currentBookValueSLM : null,
      depreciationEnabled,
    },
    actionRequired,
    issueTrend: hasIssueTrend ? issueTrend : null,
    assetStatus: hasAssetStatus ? assetStatus : null,
    latestIssues: issues,
    recentActivity: hasActivity ? recentActivity : null,
    assetValueSummary:
      hasFinancial
        ? {
            totalPurchaseValue: financial.totalPurchaseValue,
            currentBookValueSLM:
              depreciationEnabled ? financial.currentBookValueSLM : null,
            depreciationEnabled,
          }
        : null,
  };
}
