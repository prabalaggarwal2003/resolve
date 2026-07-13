import mongoose from 'mongoose';
import { Asset, Issue, AssetLog, AuditLog } from '../models/index.js';
import { calculateOrganizationMetrics } from './depreciationService.js';
import { getOrganizationKPIs } from './kpiService.js';
import { isActiveAssetStatus } from '../constants/assetStatuses.js';
import { canRead } from './permissions.js';
import { getBudgetAnalyticsSummary } from './budgetSummaryService.js';

function mapAssetFiltersToBudget(filters = {}) {
  const mapped = {};
  const keys = ['departmentId', 'locationId', 'vendorId', 'dateFrom', 'dateTo', 'category'];
  for (const k of keys) {
    if (filters[k]) mapped[k] = filters[k];
  }
  return mapped;
}

const REPLACEMENT_SCORES = { low: 25, medium: 50, high: 75, critical: 100 };

function warrantyStatus(expiry, now) {
  if (!expiry) return 'none';
  const d = new Date(expiry);
  if (d < now) return 'expired';
  const days = (d - now) / (24 * 60 * 60 * 1000);
  if (days <= 90) return 'expiring';
  return 'active';
}

function mapAssetToKpi(metrics, raw) {
  const assigned = !!(raw?.assignedTo || metrics.assignedTo);
  return {
    assetId: String(metrics.assetId),
    assetIdString: metrics.assetIdString,
    name: metrics.name,
    category: metrics.category,
    status: metrics.status,
    condition: metrics.condition || 'good',
    templateId: metrics.templateId,
    templateName: metrics.templateName,
    groupId: metrics.groupId,
    groupName: metrics.groupName,
    departmentId: metrics.departmentId,
    department: metrics.department,
    locationId: metrics.locationId,
    location: metrics.location,
    vendorId: metrics.vendorId,
    vendorName: metrics.vendorName,
    assignedToId: raw?.assignedTo ? String(raw.assignedTo) : null,
    assignedToName: raw?.assignedToName || null,
    purchaseDate: metrics.purchaseDate,
    purchaseYear: metrics.purchaseYear,
    createdAt: raw?.createdAt,
    purchaseValue: metrics.financial?.purchaseCost || 0,
    currentValue: metrics.financial?.currentBookValue || 0,
    depreciation: metrics.financial?.totalDepreciation || 0,
    replacementValue: metrics.financial?.currentBookValue || 0,
    issueCount: metrics.operational?.issueCount || 0,
    openIssueCount: metrics.operational?.openIssueCount || 0,
    maintenanceCost: metrics.operational?.maintenanceCount || 0,
    healthScore: metrics.operational?.healthScore || 0,
    replacementScore: REPLACEMENT_SCORES[metrics.operational?.replacementPriority] ?? 50,
    replacementPriority: metrics.operational?.replacementPriority || 'medium',
    utilization: assigned ? 100 : 0,
    isAssigned: assigned,
    isActive: isActiveAssetStatus(metrics.status),
    isRetired: metrics.status === 'retired',
    warrantyStatus: warrantyStatus(metrics.warrantyExpiry || raw?.warrantyExpiry, new Date()),
    warrantyActive: metrics.operational?.warrantyActive || false,
    warrantyExpiringSoon: metrics.operational?.warrantyExpiringSoon || false,
    ageYears: metrics.ageYears || 0,
  };
}

async function fetchQuickLists(organizationId) {
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    latestIssues,
    recentAssets,
    upcomingMaintenance,
    warrantyExpiringSoon,
    recentMovements,
    recentAuditLogs,
    recentlyAddedAssets,
    topVendors,
  ] = await Promise.all([
    Issue.find({ organizationId: orgId })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('assetId', 'name assetId')
      .lean(),
    Asset.find({ organizationId: orgId }).sort({ updatedAt: -1 }).limit(8).select('name assetId status updatedAt').lean(),
    Asset.find({
      organizationId: orgId,
      nextMaintenanceDate: { $gte: now, $lte: in30 },
    })
      .sort({ nextMaintenanceDate: 1 })
      .limit(8)
      .select('name assetId nextMaintenanceDate')
      .lean(),
    Asset.find({
      organizationId: orgId,
      warrantyExpiry: { $gte: now, $lte: in30 },
    })
      .sort({ warrantyExpiry: 1 })
      .limit(8)
      .select('name assetId warrantyExpiry')
      .lean(),
    AssetLog.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .populate({ path: 'assetId', select: 'name assetId organizationId', match: { organizationId: orgId } })
      .populate('userId', 'name')
      .lean()
      .then((rows) => rows.filter((r) => r.assetId)),
    AuditLog.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(8).populate('userId', 'name').lean(),
    Asset.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(8).select('name assetId createdAt category').lean(),
    Asset.aggregate([
      { $match: { organizationId: orgId, vendorId: { $exists: true, $ne: null } } },
      { $group: { _id: '$vendorId', count: { $sum: 1 }, totalValue: { $sum: '$cost' } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: 'vendors',
          localField: '_id',
          foreignField: '_id',
          as: 'vendor',
        },
      },
      { $unwind: '$vendor' },
      { $project: { name: '$vendor.name', count: 1, totalValue: 1 } },
    ]),
  ]);

  return {
    latestIssues: latestIssues.map((i) => ({
      id: String(i._id),
      title: i.title,
      status: i.status,
      priority: i.priority,
      assetName: i.assetId?.name || '—',
      assetIdString: i.assetId?.assetId || '—',
      createdAt: i.createdAt,
    })),
    recentAssets: recentAssets.map((a) => ({
      id: String(a._id),
      name: a.name,
      assetIdString: a.assetId,
      status: a.status,
      updatedAt: a.updatedAt,
    })),
    upcomingMaintenance: upcomingMaintenance.map((a) => ({
      id: String(a._id),
      name: a.name,
      assetIdString: a.assetId,
      nextMaintenanceDate: a.nextMaintenanceDate,
    })),
    warrantyExpiringSoon: warrantyExpiringSoon.map((a) => ({
      id: String(a._id),
      name: a.name,
      assetIdString: a.assetId,
      warrantyExpiry: a.warrantyExpiry,
    })),
    recentMovements: recentMovements.map((l) => ({
      id: String(l._id),
      type: l.type,
      assetName: l.assetId?.name || '—',
      userName: l.userId?.name || '—',
      createdAt: l.createdAt,
    })),
    recentAuditLogs: recentAuditLogs.map((l) => ({
      id: String(l._id),
      action: l.action,
      resource: l.resource,
      description: l.description,
      userName: l.userId?.name || '—',
      createdAt: l.createdAt,
    })),
    recentlyAddedAssets: recentlyAddedAssets.map((a) => ({
      id: String(a._id),
      name: a.name,
      assetIdString: a.assetId,
      category: a.category,
      createdAt: a.createdAt,
    })),
    topVendors: topVendors.map((v) => ({
      name: v.name,
      count: v.count,
      totalValue: v.totalValue || 0,
    })),
  };
}

export async function getKpiSummary(organizationId, userId, filters = {}, user = null) {
  const [metricsResult, rawAssets, orgKpis, quick] = await Promise.all([
    calculateOrganizationMetrics(organizationId, userId, filters),
    Asset.find({ organizationId })
      .select('_id assignedTo assignedToName createdAt warrantyExpiry')
      .lean(),
    getOrganizationKPIs(organizationId),
    fetchQuickLists(organizationId),
  ]);

  const rawMap = new Map(rawAssets.map((a) => [String(a._id), a]));
  const assets = metricsResult.assets.map((m) => mapAssetToKpi(m, rawMap.get(String(m.assetId))));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const totals = {
    totalAssets: assets.length,
    activeAssets: assets.filter((a) => a.isActive).length,
    assetsAddedThisMonth: assets.filter((a) => a.createdAt && new Date(a.createdAt) >= monthStart).length,
    assetsRetired: assets.filter((a) => a.isRetired).length,
    utilizationPct: assets.length
      ? Math.round((assets.filter((a) => a.isAssigned).length / assets.length) * 1000) / 10
      : 0,
    averageAssetAge: assets.length
      ? Math.round((assets.reduce((s, a) => s + a.ageYears, 0) / assets.length) * 10) / 10
      : 0,
    totalPurchaseValue: assets.reduce((s, a) => s + a.purchaseValue, 0),
    currentBookValue: assets.reduce((s, a) => s + a.currentValue, 0),
    totalDepreciation: assets.reduce((s, a) => s + a.depreciation, 0),
    replacementValue: assets.reduce((s, a) => s + a.replacementValue, 0),
    averageAssetCost: assets.length
      ? Math.round(assets.reduce((s, a) => s + a.purchaseValue, 0) / assets.length)
      : 0,
    warrantyActive: assets.filter((a) => a.warrantyStatus === 'active').length,
    warrantyExpiring: assets.filter((a) => a.warrantyStatus === 'expiring').length,
    warrantyExpired: assets.filter((a) => a.warrantyStatus === 'expired').length,
  };

  const lowHealthAssets = [...assets]
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 10)
    .map((a) => ({
      id: a.assetId,
      name: a.name,
      assetIdString: a.assetIdString,
      healthScore: a.healthScore,
      status: a.status,
    }));

  const replacementRecommendations = [...assets]
    .filter((a) => a.replacementScore >= 75)
    .sort((a, b) => b.replacementScore - a.replacementScore)
    .slice(0, 10)
    .map((a) => ({
      id: a.assetId,
      name: a.name,
      assetIdString: a.assetIdString,
      replacementScore: a.replacementScore,
      priority: a.replacementPriority,
    }));

  return {
    assets,
    totals,
    orgKpis,
    quick: {
      ...quick,
      lowHealthAssets,
      replacementRecommendations,
    },
    budget: user && canRead(user, 'budgets')
      ? await getBudgetAnalyticsSummary(organizationId, mapAssetFiltersToBudget(filters)).catch(() => null)
      : null,
  };
}
