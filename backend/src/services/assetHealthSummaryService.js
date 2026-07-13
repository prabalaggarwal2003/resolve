import mongoose from 'mongoose';
import { Asset, Issue, AssetLog } from '../models/index.js';
import AssetHealthScoreSnapshot from '../models/AssetHealthScoreSnapshot.js';
import {
  ensureAssetHealthOrgConfig,
  listAssetHealthProfiles,
  resolveProfileForAsset,
} from './assetHealthOrgConfigService.js';
import { buildHealthScoreResult, getHealthLevel } from './assetHealthScoreService.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function calculateAssetAge(purchaseDate) {
  if (!purchaseDate) return 0;
  const diff = Date.now() - new Date(purchaseDate).getTime();
  return Math.max(0, diff / (1000 * 60 * 60 * 24 * 365.25));
}

function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / MS_PER_DAY);
}

function applyAssetFilters(query, filters = {}) {
  if (filters.departmentId) query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
  if (filters.locationId) query.locationId = new mongoose.Types.ObjectId(filters.locationId);
  if (filters.groupId) query.groupId = new mongoose.Types.ObjectId(filters.groupId);
  if (filters.templateId) query.templateId = new mongoose.Types.ObjectId(filters.templateId);
  if (filters.vendorId) query.vendorId = new mongoose.Types.ObjectId(filters.vendorId);
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;
  if (filters.condition) query.condition = filters.condition;
  if (filters.assignedUserId) query.assignedTo = new mongoose.Types.ObjectId(filters.assignedUserId);
  if (filters.purchaseYear) {
    const y = Number(filters.purchaseYear);
    query.purchaseDate = {
      $gte: new Date(`${y}-01-01`),
      $lt: new Date(`${y + 1}-01-01`),
    };
  }
  return query;
}

async function loadAuditDaysMap(organizationId, assetIds) {
  if (!assetIds.length) return {};
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const rows = await AssetLog.aggregate([
    { $match: { assetId: { $in: assetIds }, type: { $in: ['check_in', 'check_out', 'edit'] } } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'assets',
        localField: 'assetId',
        foreignField: '_id',
        as: 'asset',
      },
    },
    { $unwind: '$asset' },
    { $match: { 'asset.organizationId': orgId } },
    { $group: { _id: '$assetId', lastAudit: { $first: '$createdAt' } } },
  ]);
  return Object.fromEntries(
    rows.map((r) => [String(r._id), daysSince(r.lastAudit) ?? 999])
  );
}

async function loadIssueCounts(organizationId, assetIds) {
  if (!assetIds.length) return {};
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const rows = await Issue.aggregate([
    { $match: { organizationId: orgId, assetId: { $in: assetIds } } },
    {
      $group: {
        _id: '$assetId',
        total: { $sum: 1 },
        open: {
          $sum: {
            $cond: [{ $in: ['$status', ['open', 'in_progress']] }, 1, 0],
          },
        },
      },
    },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), { total: r.total, open: r.open }]));
}

export async function scoreAsset(asset, orgConfig, profile, auditDaysMap, issueMap) {
  const id = String(asset._id);
  const issues = issueMap[id] || { total: 0, open: 0 };
  const input = {
    ageYears: calculateAssetAge(asset.purchaseDate),
    condition: asset.condition || 'good',
    openIssueCount: issues.open,
    issueCount: issues.total,
    maintenanceCount: asset.maintenanceHistory?.length || (asset.maintenanceStartDate ? 1 : 0),
    warrantyExpiry: asset.warrantyExpiry,
    daysSinceLastAudit: auditDaysMap[id] ?? daysSince(asset.updatedAt) ?? 999,
    status: asset.status || 'available',
  };
  return buildHealthScoreResult(input, orgConfig, profile);
}

export async function getAssetHealthSummaryData(organizationId, filters = {}) {
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const query = applyAssetFilters({ organizationId: orgId }, filters);

  const [orgConfig, profiles, assets] = await Promise.all([
    ensureAssetHealthOrgConfig(organizationId),
    listAssetHealthProfiles(organizationId),
    Asset.find(query)
      .select('assetId name category status condition purchaseDate warrantyExpiry maintenanceHistory maintenanceStartDate updatedAt groupId departmentId locationId templateId vendorId assignedTo')
      .populate('groupId', 'name')
      .populate('departmentId', 'name')
      .populate('locationId', 'name')
      .lean(),
  ]);

  const profileByGroup = Object.fromEntries(
    profiles.filter((p) => p.groupId && p.enabled).map((p) => [String(p.groupId), p])
  );

  const assetIds = assets.map((a) => a._id);
  const [auditDaysMap, issueMap] = await Promise.all([
    loadAuditDaysMap(organizationId, assetIds),
    loadIssueCounts(organizationId, assetIds),
  ]);

  const scored = [];
  const distribution = { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 };
  let scoreSum = 0;

  for (const asset of assets) {
    const groupId = asset.groupId?._id || asset.groupId;
    const profile = groupId ? profileByGroup[String(groupId)] || null : null;
    const result = await scoreAsset(asset, orgConfig, profile, auditDaysMap, issueMap);
    const levelKey = result.healthLevel || 'fair';
    if (distribution[levelKey] != null) distribution[levelKey]++;
    scoreSum += result.healthScore;

    scored.push({
      assetId: String(asset._id),
      assetIdString: asset.assetId,
      name: asset.name,
      category: asset.category,
      status: asset.status,
      condition: asset.condition,
      groupId: groupId ? String(groupId) : null,
      groupName: asset.groupId?.name || null,
      departmentId: asset.departmentId?._id ? String(asset.departmentId._id) : null,
      department: asset.departmentId?.name || null,
      locationId: asset.locationId?._id ? String(asset.locationId._id) : null,
      location: asset.locationId?.name || null,
      healthScore: result.healthScore,
      healthLabel: result.healthLabel,
      healthLevel: result.healthLevel,
      healthEmoji: result.healthEmoji,
      factorScores: result.factorScores,
      breakdown: result.breakdown,
      profileName: result.profileName,
    });
  }

  const total = scored.length;
  const avgScore = total ? Math.round(scoreSum / total) : 0;

  const lowestHealthAssets = [...scored]
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 20);

  const conditionSummary = await getConditionCounts(organizationId, filters);

  return {
    totals: {
      totalAssets: total,
      avgHealthScore: avgScore,
      distribution,
    },
    assets: scored,
    lowestHealthAssets,
    conditionSummary,
    healthLevels: orgConfig.healthLevels,
    config: {
      factors: orgConfig.factors,
      autoUpdateCondition: orgConfig.autoUpdateCondition,
    },
  };
}

async function getConditionCounts(organizationId, filters = {}) {
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const match = applyAssetFilters({ organizationId: orgId }, filters);
  const rows = await Asset.aggregate([
    { $match: match },
    { $group: { _id: '$condition', count: { $sum: 1 } } },
  ]);
  const summary = {
    total: 0,
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    critical: 0,
    under_maintenance: 0,
  };
  for (const row of rows) {
    const key = row._id || 'good';
    if (summary[key] != null) summary[key] = row.count;
    summary.total += row.count;
  }
  return summary;
}

export async function recordHealthSnapshot(organizationId) {
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const data = await getAssetHealthSummaryData(organizationId);
  const date = new Date().toISOString().slice(0, 10);
  await AssetHealthScoreSnapshot.findOneAndUpdate(
    { organizationId: orgId, date },
    {
      $set: {
        avgScore: data.totals.avgHealthScore,
        assetCount: data.totals.totalAssets,
        distribution: data.totals.distribution,
      },
    },
    { upsert: true, new: true }
  );
}

export async function getHealthTrend(organizationId, days = 30) {
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  const snapshots = await AssetHealthScoreSnapshot.find({
    organizationId: orgId,
    date: { $gte: sinceStr },
  })
    .sort({ date: 1 })
    .lean();

  if (!snapshots.length) {
    await recordHealthSnapshot(organizationId);
    const today = await AssetHealthScoreSnapshot.findOne({
      organizationId: orgId,
      date: new Date().toISOString().slice(0, 10),
    }).lean();
    return today ? [{ date: today.date, avgScore: today.avgScore, distribution: today.distribution, assetCount: today.assetCount }] : [];
  }
  return snapshots.map((s) => ({
    date: s.date,
    avgScore: s.avgScore,
    distribution: s.distribution,
    assetCount: s.assetCount,
  }));
}

export async function previewHealthScore(organizationId, body) {
  const orgConfig = await ensureAssetHealthOrgConfig(organizationId);
  const mergedConfig = {
    ...orgConfig,
    factors: body.factors || orgConfig.factors,
    thresholds: body.thresholds
      ? { ...orgConfig.thresholds, ...body.thresholds }
      : orgConfig.thresholds,
    healthLevels: body.healthLevels || orgConfig.healthLevels,
  };

  const sampleAsset = body.sampleAsset || {
    ageYears: 3,
    condition: 'good',
    openIssueCount: 1,
    maintenanceCount: 2,
    warrantyExpiry: new Date(Date.now() + 60 * MS_PER_DAY),
    daysSinceLastAudit: 45,
    status: 'in_use',
  };

  let profile = null;
  if (body.groupId) {
    profile = await resolveProfileForAsset(organizationId, body.groupId);
    if (body.profileOverrides) {
      profile = { ...profile, ...body.profileOverrides, enabled: true };
    }
  }

  return buildHealthScoreResult(sampleAsset, mergedConfig, profile);
}

export { getHealthLevel };
