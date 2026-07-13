import { Asset, Issue } from '../models/index.js';
import {
  loadPolicyContext,
  resolvePolicyForAsset,
  effectiveRate,
  getRateForDepreciationYear,
} from './depreciationPolicyService.js';
import { buildHealthScoreResult, healthLabel as healthLabelFromScore } from './assetHealthScoreService.js';
import { DEFAULT_ASSET_HEALTH_CONFIG } from '../constants/assetHealthDefaults.js';
import { ensureAssetHealthOrgConfig, listAssetHealthProfiles } from './assetHealthOrgConfigService.js';

const REPLACEMENT_PRIORITY = {
  low: { label: 'Low', emoji: '🟢', description: 'Healthy' },
  medium: { label: 'Medium', emoji: '🟡', description: 'Monitor' },
  high: { label: 'High', emoji: '🟠', description: 'Replace Soon' },
  critical: { label: 'Critical', emoji: '🔴', description: 'Replace Immediately' },
};

const HIGH_VALUE_THRESHOLD = 100000;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function calculateAssetAge(purchaseDate) {
  if (!purchaseDate) return 0;
  const diff = Date.now() - new Date(purchaseDate).getTime();
  return Math.max(0, diff / (1000 * 60 * 60 * 24 * 365.25));
}

function isWarrantyExpired(warrantyExpiry) {
  if (!warrantyExpiry) return true;
  return new Date(warrantyExpiry) < new Date();
}

function isWarrantyExpiringSoon(warrantyExpiry, days = 30) {
  if (!warrantyExpiry) return false;
  const diff = (new Date(warrantyExpiry) - Date.now()) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= days;
}

function isUnderWarranty(warrantyExpiry) {
  if (!warrantyExpiry) return false;
  return new Date(warrantyExpiry) >= new Date();
}

function usefulLifeFromPolicy(policy, overrideRate) {
  const schedule = policy?.yearRates || [];
  if (schedule.length) {
    const residualPct = policy?.residualPct || 5;
    if (policy?.method === 'WDV') {
      let remaining = 100;
      for (const row of schedule.sort((a, b) => a.year - b.year)) {
        remaining *= 1 - row.rate / 100;
        if (remaining <= residualPct) return row.year;
      }
      const fallback = Number(policy.rate) || 15;
      if (fallback <= 0) return schedule.length;
      return schedule.length + Math.ceil(Math.log(residualPct / remaining) / Math.log(1 - fallback / 100));
    }
    const totalScheduled = schedule.reduce((sum, row) => sum + row.rate, 0);
    const depreciablePct = Math.max(0, 100 - residualPct);
    if (totalScheduled >= depreciablePct) return schedule[schedule.length - 1].year;
    const fallback = Number(policy.rate) || 15;
    return schedule.length + Math.ceil((depreciablePct - totalScheduled) / fallback);
  }
  const rate = overrideRate ?? policy?.rate;
  if (!rate || rate <= 0) return 5;
  const residualPct = policy?.residualPct || 5;
  const depreciablePct = Math.max(0, 100 - residualPct);
  return Math.max(1, Math.ceil(depreciablePct / rate));
}

/** Policy-based SLM with optional per-year schedule */
function calculatePolicySLM(cost, ageYears, policy, overrideRate) {
  const flatRate = overrideRate ?? policy?.rate ?? 0;
  if (!cost || cost <= 0) {
    return emptyFinancial('SLM', flatRate);
  }
  const residualPct = policy?.residualPct ?? 5;
  const residualValue = cost * (residualPct / 100);
  const maxDepreciation = cost - residualValue;

  const fullYears = Math.floor(ageYears);
  const partialYear = ageYears - fullYears;
  let totalDepreciation = 0;

  for (let y = 1; y <= fullYears; y++) {
    const ratePct = getRateForDepreciationYear(policy, y, overrideRate);
    totalDepreciation += cost * (ratePct / 100);
  }
  if (partialYear > 0) {
    const ratePct = getRateForDepreciationYear(policy, fullYears + 1, overrideRate);
    totalDepreciation += cost * (ratePct / 100) * partialYear;
  }
  totalDepreciation = Math.min(totalDepreciation, maxDepreciation);

  const currentBookValue = cost - totalDepreciation;
  const usefulLife = usefulLifeFromPolicy(policy, overrideRate);
  const currentYearRate = getRateForDepreciationYear(policy, Math.max(1, fullYears + 1), overrideRate);

  return {
    method: 'SLM',
    purchaseCost: round2(cost),
    residualValue: round2(residualValue),
    usefulLife: round2(usefulLife),
    annualDepreciation: round2(cost * (currentYearRate / 100)),
    depreciationRate: currentYearRate,
    currentBookValue: round2(currentBookValue),
    totalDepreciation: round2(totalDepreciation),
    depreciationPercentage: round2((totalDepreciation / cost) * 100),
  };
}

/** Policy-based WDV with optional per-year schedule */
function calculatePolicyWDV(cost, ageYears, policy, overrideRate) {
  const flatRate = overrideRate ?? policy?.rate ?? 0;
  if (!cost || cost <= 0) {
    return emptyFinancial('WDV', flatRate);
  }
  const residualPct = policy?.residualPct ?? 5;
  const fullYears = Math.floor(ageYears);
  const partialYear = ageYears - fullYears;
  let bookValue = cost;

  for (let y = 1; y <= fullYears; y++) {
    const ratePct = getRateForDepreciationYear(policy, y, overrideRate);
    bookValue *= 1 - ratePct / 100;
  }
  if (partialYear > 0) {
    const ratePct = getRateForDepreciationYear(policy, fullYears + 1, overrideRate);
    bookValue *= 1 - (ratePct / 100) * partialYear;
  }

  const residualFloor = cost * (residualPct / 100);
  bookValue = Math.max(bookValue, residualFloor);
  const totalDepreciation = cost - bookValue;
  const usefulLife = usefulLifeFromPolicy(policy, overrideRate);
  const currentYearRate = getRateForDepreciationYear(policy, Math.max(1, fullYears + 1), overrideRate);

  return {
    method: 'WDV',
    purchaseCost: round2(cost),
    residualValue: round2(residualFloor),
    usefulLife: round2(usefulLife),
    annualDepreciation: round2(bookValue * (currentYearRate / 100)),
    depreciationRate: currentYearRate,
    currentBookValue: round2(bookValue),
    totalDepreciation: round2(totalDepreciation),
    depreciationPercentage: round2((totalDepreciation / cost) * 100),
  };
}

function emptyFinancial(method, ratePct) {
  return {
    method,
    purchaseCost: 0,
    residualValue: 0,
    usefulLife: 5,
    annualDepreciation: 0,
    depreciationRate: ratePct,
    currentBookValue: 0,
    totalDepreciation: 0,
    depreciationPercentage: 0,
  };
}

function calculateFromPolicy(cost, ageYears, policy, overrideRate) {
  if (!policy) return emptyFinancial('SLM', 0);
  if (policy.method === 'WDV') return calculatePolicyWDV(cost, ageYears, policy, overrideRate);
  return calculatePolicySLM(cost, ageYears, policy, overrideRate);
}

function calculateHealthScore(asset, ageYears, issueCount, openIssueCount, maintenanceCount, usefulLife, healthCtx = null) {
  const input = {
    ageYears,
    condition: asset.condition || 'good',
    openIssueCount,
    issueCount,
    maintenanceCount,
    warrantyExpiry: asset.warrantyExpiry,
    daysSinceLastAudit: healthCtx?.auditDaysMap?.[String(asset._id)] ?? 180,
    status: asset.status || 'available',
  };
  const orgConfig = healthCtx?.orgConfig || DEFAULT_ASSET_HEALTH_CONFIG;
  const groupId = asset.groupId?._id || asset.groupId;
  const profile = groupId && healthCtx?.profileByGroup
    ? healthCtx.profileByGroup[String(groupId)] || null
    : null;
  return buildHealthScoreResult(input, orgConfig, profile).healthScore;
}

function healthLabel(score, healthLevels) {
  return healthLabelFromScore(score, healthLevels || DEFAULT_ASSET_HEALTH_CONFIG.healthLevels);
}

function calculateReplacementPriority(asset, healthScore, ageYears, issueCount, openIssueCount, maintenanceCount, usefulLife) {
  let risk = 0;
  const ageRatio = usefulLife > 0 ? ageYears / usefulLife : 0;
  if (ageRatio >= 1) risk += 35;
  else if (ageRatio >= 0.75) risk += 22;
  else if (ageRatio >= 0.5) risk += 10;
  risk += Math.max(0, 100 - healthScore) * 0.4;
  risk += Math.min(openIssueCount * 6, 24);
  risk += Math.min(maintenanceCount * 4, 16);
  if (isWarrantyExpired(asset.warrantyExpiry)) risk += 12;
  else if (isWarrantyExpiringSoon(asset.warrantyExpiry)) risk += 6;
  if (['needs_repair', 'out_of_service'].includes(asset.status)) risk += 15;
  if (asset.status === 'under_maintenance') risk += 8;

  let level = 'low';
  if (risk >= 70 || healthScore < 35) level = 'critical';
  else if (risk >= 48 || healthScore < 50) level = 'high';
  else if (risk >= 28 || healthScore < 75) level = 'medium';

  const remainingUsefulLife = Math.max(0, usefulLife - ageYears);
  const healthAdjustedRemaining = remainingUsefulLife * (healthScore / 100);

  return {
    level,
    ...REPLACEMENT_PRIORITY[level],
    riskScore: Math.round(risk),
    estimatedRemainingUsefulLife: round2(healthAdjustedRemaining),
  };
}

function buildIndicators(financial, operational, cost) {
  const depPct = financial.depreciationPercentage || 0;
  const nearEnd = operational.estimatedRemainingUsefulLife <= 1 && operational.estimatedRemainingUsefulLife >= 0;
  return {
    fullyDepreciated: depPct >= 98 || financial.currentBookValue <= financial.residualValue,
    nearEndOfLife: nearEnd || depPct >= 85,
    replacementRecommended: ['high', 'critical'].includes(operational.replacementPriority),
    highValueAsset: cost >= HIGH_VALUE_THRESHOLD,
  };
}

function buildAssetMetrics(asset, issueCount, openIssueCount, ctx, healthCtx = null) {
  const cost = typeof asset.cost === 'number' ? asset.cost : parseFloat(asset.cost) || 0;
  const category = asset.category || 'Other';
  const ageYears = calculateAssetAge(asset.purchaseDate);
  const maintenanceCount = asset.maintenanceHistory?.length || (asset.maintenanceStartDate ? 1 : 0);

  const { policy, source } = resolvePolicyForAsset(asset, ctx);
  const overrideRate =
    asset.depreciationRateOverride != null && asset.depreciationRateOverride !== ''
      ? Number(asset.depreciationRateOverride)
      : null;
  const effRate = policy ? effectiveRate(asset, policy) : 0;
  const financial = calculateFromPolicy(cost, ageYears, policy, overrideRate);
  const usefulLife = financial.usefulLife || 5;

  const healthScore = calculateHealthScore(asset, ageYears, issueCount, openIssueCount, maintenanceCount, usefulLife, healthCtx);
  const replacement = calculateReplacementPriority(
    asset, healthScore, ageYears, issueCount, openIssueCount, maintenanceCount, usefulLife
  );

  const operational = {
    healthScore,
    healthLabel: healthLabel(healthScore, healthCtx?.orgConfig?.healthLevels),
    replacementPriority: replacement.level,
    replacementLabel: replacement.label,
    replacementEmoji: replacement.emoji,
    replacementDescription: replacement.description,
    estimatedRemainingUsefulLife: replacement.estimatedRemainingUsefulLife,
    issueCount,
    openIssueCount,
    maintenanceCount,
    warrantyActive: isUnderWarranty(asset.warrantyExpiry),
    warrantyExpiringSoon: isWarrantyExpiringSoon(asset.warrantyExpiry),
  };

  const indicators = buildIndicators(financial, operational, cost);

  const slm =
    policy?.method === 'SLM'
      ? financial
      : calculatePolicySLM(cost, ageYears, policy, overrideRate);
  const wdv =
    policy?.method === 'WDV'
      ? financial
      : calculatePolicyWDV(cost, ageYears, policy, overrideRate);

  const templateId = asset.templateId?._id || asset.templateId;
  const groupId = asset.groupId?._id || asset.groupId;

  return {
    assetId: asset._id,
    assetIdString: asset.assetId,
    name: asset.name,
    category,
    templateId: templateId ? String(templateId) : null,
    templateName: asset.templateId?.name || null,
    groupId: groupId ? String(groupId) : null,
    groupName: asset.groupId?.name || null,
    location: asset.locationId?.name,
    locationId: asset.locationId?._id ? String(asset.locationId._id) : null,
    department: asset.departmentId?.name,
    departmentId: asset.departmentId?._id ? String(asset.departmentId._id) : null,
    vendorId: asset.vendorId?._id ? String(asset.vendorId._id) : null,
    vendorName: asset.vendorId?.name || null,
    purchaseDate: asset.purchaseDate,
    purchaseYear: asset.purchaseDate ? new Date(asset.purchaseDate).getFullYear() : null,
    warrantyExpiry: asset.warrantyExpiry,
    status: asset.status,
    condition: asset.condition || 'good',
    ageYears: round2(ageYears),
    policy: policy
      ? {
          id: String(policy._id),
          name: policy.name,
          method: policy.method,
          rate: policy.rate,
          yearRates: policy.yearRates || [],
          effectiveRate: effRate,
          source,
          hasOverride: asset.depreciationRateOverride != null && asset.depreciationRateOverride !== '',
          overrideReason: asset.depreciationOverrideReason || null,
        }
      : null,
    financial,
    slm,
    wdv,
    operational,
    indicators,
    originalCost: financial.purchaseCost,
    currentValue: financial.currentBookValue,
    depreciation: financial.totalDepreciation,
    depreciationPercentage: financial.depreciationPercentage,
  };
}

function matchesFilters(metrics, filters) {
  if (!filters || Object.keys(filters).length === 0) return true;

  if (filters.method && metrics.policy?.method !== filters.method) return false;
  if (filters.policyId && metrics.policy?.id !== filters.policyId) return false;
  if (filters.groupId && metrics.groupId !== filters.groupId) return false;
  if (filters.templateId && metrics.templateId !== filters.templateId) return false;
  if (filters.category && metrics.category !== filters.category) return false;
  if (filters.purchaseYear && String(metrics.purchaseYear) !== String(filters.purchaseYear)) return false;
  if (filters.departmentId && metrics.departmentId !== filters.departmentId) return false;
  if (filters.locationId && metrics.locationId !== filters.locationId) return false;
  if (filters.vendorId && metrics.vendorId !== filters.vendorId) return false;

  if (filters.warrantyStatus === 'active' && !metrics.operational.warrantyActive) return false;
  if (filters.warrantyStatus === 'expired' && metrics.operational.warrantyActive) return false;
  if (filters.warrantyStatus === 'expiring' && !metrics.operational.warrantyExpiringSoon) return false;

  if (filters.fullyDepreciated === 'true' && !metrics.indicators.fullyDepreciated) return false;
  if (filters.replacementPriority && metrics.operational.replacementPriority !== filters.replacementPriority) return false;

  const cost = metrics.financial.purchaseCost;
  const book = metrics.financial.currentBookValue;
  const depPct = metrics.financial.depreciationPercentage;
  const health = metrics.operational.healthScore;

  if (filters.purchaseMin && cost < Number(filters.purchaseMin)) return false;
  if (filters.purchaseMax && cost > Number(filters.purchaseMax)) return false;
  if (filters.bookMin && book < Number(filters.bookMin)) return false;
  if (filters.bookMax && book > Number(filters.bookMax)) return false;
  if (filters.depPctMin && depPct < Number(filters.depPctMin)) return false;
  if (filters.depPctMax && depPct > Number(filters.depPctMax)) return false;
  if (filters.healthMin && health < Number(filters.healthMin)) return false;

  return true;
}

async function fetchIssueCountsByAsset(assetIds) {
  if (!assetIds.length) return new Map();
  const stats = await Issue.aggregate([
    { $match: { assetId: { $in: assetIds } } },
    {
      $group: {
        _id: '$assetId',
        issueCount: { $sum: 1 },
        openIssueCount: {
          $sum: { $cond: [{ $in: ['$status', ['open', 'in_progress']] }, 1, 0] },
        },
      },
    },
  ]);
  const map = new Map();
  for (const row of stats) {
    map.set(String(row._id), { issueCount: row.issueCount, openIssueCount: row.openIssueCount });
  }
  return map;
}

function buildDashboardExtras(assets, summary) {
  const byGroup = {};
  const byPolicy = {};
  const currentYear = new Date().getFullYear();
  let depreciationThisYear = 0;

  for (const a of assets) {
    const g = a.groupName || 'Ungrouped';
    if (!byGroup[g]) byGroup[g] = { name: g, bookValue: 0, purchaseValue: 0, count: 0 };
    byGroup[g].bookValue += a.financial.currentBookValue;
    byGroup[g].purchaseValue += a.financial.purchaseCost;
    byGroup[g].count++;

    const p = a.policy?.name || 'No policy';
    if (!byPolicy[p]) byPolicy[p] = { name: p, depreciation: 0, count: 0 };
    byPolicy[p].depreciation += a.financial.totalDepreciation;
    byPolicy[p].count++;

    if (a.purchaseYear === currentYear) {
      depreciationThisYear += a.financial.annualDepreciation || 0;
    }
  }

  const mostDepreciated = [...assets]
    .sort((x, y) => y.financial.depreciationPercentage - x.financial.depreciationPercentage)
    .slice(0, 5);

  const nearEndOfLife = assets
    .filter((a) => a.indicators.nearEndOfLife || a.indicators.replacementRecommended)
    .sort((x, y) => x.operational.estimatedRemainingUsefulLife - y.operational.estimatedRemainingUsefulLife)
    .slice(0, 10);

  return {
    depreciationThisYear: round2(depreciationThisYear),
    bookValueByGroup: Object.values(byGroup).map((g) => ({
      ...g,
      bookValue: round2(g.bookValue),
      purchaseValue: round2(g.purchaseValue),
    })),
    depreciationByPolicy: Object.values(byPolicy).map((p) => ({
      ...p,
      depreciation: round2(p.depreciation),
    })),
    mostDepreciated,
    nearEndOfLife,
  };
}

export async function calculateOrganizationMetrics(organizationId, userId, filters = {}) {
  const ctx = await loadPolicyContext(organizationId, userId);
  const [orgConfig, profiles] = await Promise.all([
    ensureAssetHealthOrgConfig(organizationId),
    listAssetHealthProfiles(organizationId),
  ]);
  const profileByGroup = Object.fromEntries(
    profiles.filter((p) => p.groupId && p.enabled).map((p) => [String(p.groupId), p])
  );
  const healthCtx = { orgConfig, profileByGroup, auditDaysMap: {} };

  const assets = await Asset.find({ organizationId })
    .populate('locationId', 'name')
    .populate('departmentId', 'name')
    .populate('groupId', 'name')
    .populate('templateId', 'name')
    .populate('vendorId', 'name vendorId')
    .populate('depreciationPolicyId', 'name method rate')
    .lean();

  const assetIds = assets.map((a) => a._id);
  const issueStats = await fetchIssueCountsByAsset(assetIds);
  const results = [];

  let totalPurchaseValue = 0;
  let totalBookValue = 0;
  let totalHealth = 0;
  let assetsNeedingReplacement = 0;
  let assetsUnderWarranty = 0;
  let warrantiesExpiringSoon = 0;

  for (const asset of assets) {
    try {
      const counts = issueStats.get(String(asset._id)) || { issueCount: 0, openIssueCount: 0 };
      const metrics = buildAssetMetrics(asset, counts.issueCount, counts.openIssueCount, ctx, healthCtx);
      if (!matchesFilters(metrics, filters)) continue;

      results.push(metrics);
      totalPurchaseValue += metrics.financial.purchaseCost;
      totalBookValue += metrics.financial.currentBookValue;
      totalHealth += metrics.operational.healthScore;
      if (['high', 'critical'].includes(metrics.operational.replacementPriority)) assetsNeedingReplacement++;
      if (metrics.operational.warrantyActive) assetsUnderWarranty++;
      if (metrics.operational.warrantyExpiringSoon) warrantiesExpiringSoon++;
    } catch (err) {
      console.error(`Metrics error for asset ${asset.assetId}:`, err.message);
    }
  }

  const count = results.length;
  const summary = {
    totalAssets: count,
    totalPurchaseValue: round2(totalPurchaseValue),
    currentBookValue: round2(totalBookValue),
    currentBookValueSLM: round2(totalBookValue),
    currentBookValueWDV: round2(totalBookValue),
    totalDepreciation: round2(totalPurchaseValue - totalBookValue),
    totalDepreciationSLM: round2(totalPurchaseValue - totalBookValue),
    totalDepreciationWDV: round2(totalPurchaseValue - totalBookValue),
    averageAssetHealth: count > 0 ? round2(totalHealth / count) : 0,
    assetsNeedingReplacement,
    assetsUnderWarranty,
    warrantiesExpiringSoon,
    totalOriginalValue: round2(totalPurchaseValue),
    totalCurrentValue: round2(totalBookValue),
    averageDepreciationPercentage:
      totalPurchaseValue > 0 ? round2(((totalPurchaseValue - totalBookValue) / totalPurchaseValue) * 100) : 0,
  };

  const dashboard = buildDashboardExtras(results, summary);

  return { assets: results, summary, dashboard, policies: ctx.policyById ? Object.values(ctx.policyById) : [] };
}

export async function calculateAssetMetrics(assetId, organizationId, userId) {
  const ctx = await loadPolicyContext(organizationId, userId);
  const asset = await Asset.findById(assetId)
    .populate('locationId', 'name')
    .populate('departmentId', 'name')
    .populate('groupId', 'name')
    .populate('templateId', 'name')
    .populate('vendorId', 'name vendorId')
    .lean();
  if (!asset) throw new Error('Asset not found');
  const issueStats = await fetchIssueCountsByAsset([asset._id]);
  const counts = issueStats.get(String(asset._id)) || { issueCount: 0, openIssueCount: 0 };
  return buildAssetMetrics(asset, counts.issueCount, counts.openIssueCount, ctx);
}

export async function getDepreciationByCategory(organizationId, userId, filters) {
  const result = await calculateOrganizationMetrics(organizationId, userId, filters);
  const categoryMap = {};
  result.assets.forEach((asset) => {
    const cat = asset.category || 'Uncategorized';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { category: cat, count: 0, purchaseValue: 0, bookValue: 0, totalHealth: 0, needingReplacement: 0 };
    }
    const c = categoryMap[cat];
    c.count++;
    c.purchaseValue += asset.financial.purchaseCost;
    c.bookValue += asset.financial.currentBookValue;
    c.totalHealth += asset.operational.healthScore;
    if (['high', 'critical'].includes(asset.operational.replacementPriority)) c.needingReplacement++;
  });
  const categories = Object.values(categoryMap).map((cat) => ({
    ...cat,
    purchaseValue: round2(cat.purchaseValue),
    bookValue: round2(cat.bookValue),
    bookValueSLM: round2(cat.bookValue),
    averageHealth: cat.count > 0 ? round2(cat.totalHealth / cat.count) : 0,
    depreciation: round2(cat.purchaseValue - cat.bookValue),
    depreciationPercentage: cat.purchaseValue > 0 ? round2(((cat.purchaseValue - cat.bookValue) / cat.purchaseValue) * 100) : 0,
  }));
  return { categories, summary: result.summary };
}

export async function calculateAssetDepreciation(assetId, organizationId, userId) {
  return calculateAssetMetrics(assetId, organizationId, userId);
}

export async function calculateOrganizationDepreciation(organizationId, userId, filters) {
  return calculateOrganizationMetrics(organizationId, userId, filters);
}

export { REPLACEMENT_PRIORITY, calculateAssetAge, usefulLifeFromPolicy };

/** @deprecated Legacy category config for dashboard overview */
const CATEGORY_CONFIG = {
  Projector: { usefulLife: 5, residualPct: 0.05, wdvRate: 0.25 },
  Laptop: { usefulLife: 3, residualPct: 0.10, wdvRate: 0.35 },
  Desktop: { usefulLife: 4, residualPct: 0.10, wdvRate: 0.30 },
  Furniture: { usefulLife: 10, residualPct: 0.05, wdvRate: 0.12 },
  Other: { usefulLife: 5, residualPct: 0.075, wdvRate: 0.20 },
};

function getCategoryConfig(category) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Other;
}

function calculateSLM(cost, ageYears, config) {
  const policy = {
    method: 'SLM',
    rate: config.usefulLife > 0 ? (100 - config.residualPct * 100) / config.usefulLife : 15,
    residualPct: config.residualPct * 100,
    yearRates: [],
  };
  return calculatePolicySLM(cost, ageYears, policy, null);
}

export { calculateSLM, getCategoryConfig, CATEGORY_CONFIG as DEPRECIATION_CATEGORY_CONFIG };
