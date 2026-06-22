import { Asset, Issue } from '../models/index.js';

/** Category defaults: useful life (years), residual %, WDV annual rate */
const CATEGORY_CONFIG = {
  Projector: { usefulLife: 5, residualPct: 0.05, wdvRate: 0.25 },
  Whiteboard: { usefulLife: 10, residualPct: 0.05, wdvRate: 0.15 },
  Desktop: { usefulLife: 4, residualPct: 0.10, wdvRate: 0.30 },
  Laptop: { usefulLife: 3, residualPct: 0.10, wdvRate: 0.35 },
  AC: { usefulLife: 8, residualPct: 0.05, wdvRate: 0.20 },
  Furniture: { usefulLife: 10, residualPct: 0.05, wdvRate: 0.12 },
  'Lab Equipment': { usefulLife: 7, residualPct: 0.08, wdvRate: 0.22 },
  Printer: { usefulLife: 5, residualPct: 0.08, wdvRate: 0.28 },
  Other: { usefulLife: 5, residualPct: 0.075, wdvRate: 0.20 },
};

const DEFAULT_CATEGORY = { usefulLife: 5, residualPct: 0.075, wdvRate: 0.20 };

const CONDITION_BASE = {
  excellent: 95,
  good: 82,
  fair: 65,
  poor: 45,
  critical: 25,
  under_maintenance: 40,
};

const STATUS_PENALTY = {
  available: 0,
  in_use: 0,
  working: 0,
  under_maintenance: -12,
  needs_repair: -22,
  out_of_service: -35,
  retired: -50,
};

const REPLACEMENT_PRIORITY = {
  low: { label: 'Low', emoji: '🟢', description: 'Healthy' },
  medium: { label: 'Medium', emoji: '🟡', description: 'Monitor' },
  high: { label: 'High', emoji: '🟠', description: 'Replace Soon' },
  critical: { label: 'Critical', emoji: '🔴', description: 'Replace Immediately' },
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function calculateAssetAge(purchaseDate) {
  if (!purchaseDate) return 0;
  const diff = Date.now() - new Date(purchaseDate).getTime();
  return Math.max(0, diff / (1000 * 60 * 60 * 24 * 365.25));
}

function getCategoryConfig(category) {
  return CATEGORY_CONFIG[category] || DEFAULT_CATEGORY;
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

/** Straight Line Method */
function calculateSLM(cost, ageYears, config) {
  if (!cost || cost <= 0) {
    return {
      purchaseCost: 0,
      residualValue: 0,
      usefulLife: config.usefulLife,
      annualDepreciation: 0,
      currentBookValue: 0,
      totalDepreciation: 0,
      depreciationPercentage: 0,
    };
  }

  const residualValue = cost * config.residualPct;
  const depreciableAmount = cost - residualValue;
  const annualDepreciation = depreciableAmount / config.usefulLife;
  const yearsDepreciated = Math.min(ageYears, config.usefulLife);
  const totalDepreciation = Math.min(annualDepreciation * yearsDepreciated, depreciableAmount);
  const currentBookValue = cost - totalDepreciation;
  const depreciationPercentage = (totalDepreciation / cost) * 100;

  return {
    purchaseCost: round2(cost),
    residualValue: round2(residualValue),
    usefulLife: config.usefulLife,
    annualDepreciation: round2(annualDepreciation),
    currentBookValue: round2(currentBookValue),
    totalDepreciation: round2(totalDepreciation),
    depreciationPercentage: round2(depreciationPercentage),
  };
}

/** Written Down Value — compound yearly */
function calculateWDV(cost, ageYears, config) {
  if (!cost || cost <= 0) {
    return {
      purchaseCost: 0,
      depreciationRate: config.wdvRate,
      currentBookValue: 0,
      totalDepreciation: 0,
      depreciationPercentage: 0,
    };
  }

  const fullYears = Math.floor(ageYears);
  const partialYear = ageYears - fullYears;
  let bookValue = cost;

  for (let y = 0; y < fullYears; y++) {
    bookValue *= 1 - config.wdvRate;
  }
  if (partialYear > 0) {
    bookValue *= 1 - config.wdvRate * partialYear;
  }

  const residualFloor = cost * config.residualPct;
  bookValue = Math.max(bookValue, residualFloor);
  const totalDepreciation = cost - bookValue;

  return {
    purchaseCost: round2(cost),
    depreciationRate: config.wdvRate,
    currentBookValue: round2(bookValue),
    totalDepreciation: round2(totalDepreciation),
    depreciationPercentage: round2((totalDepreciation / cost) * 100),
  };
}

function calculateHealthScore(asset, ageYears, issueCount, openIssueCount, maintenanceCount) {
  const condition = asset.condition || 'good';
  let score = CONDITION_BASE[condition] ?? 70;

  score -= Math.min(openIssueCount * 4, 24);
  score -= Math.min((issueCount - openIssueCount) * 1.5, 12);
  score -= Math.min(maintenanceCount * 3, 18);

  if (isUnderWarranty(asset.warrantyExpiry)) score += 5;
  else if (isWarrantyExpired(asset.warrantyExpiry)) score -= 8;

  score += STATUS_PENALTY[asset.status] ?? 0;

  const config = getCategoryConfig(asset.category);
  const ageRatio = config.usefulLife > 0 ? ageYears / config.usefulLife : 0;
  if (ageRatio > 1) score -= 15;
  else if (ageRatio > 0.75) score -= 8;
  else if (ageRatio > 0.5) score -= 4;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function healthLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Attention';
  return 'Poor';
}

function calculateReplacementPriority(asset, healthScore, ageYears, issueCount, openIssueCount, maintenanceCount, config) {
  let risk = 0;

  const ageRatio = config.usefulLife > 0 ? ageYears / config.usefulLife : 0;
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

  const remainingUsefulLife = Math.max(0, config.usefulLife - ageYears);
  const healthAdjustedRemaining = remainingUsefulLife * (healthScore / 100);

  return {
    level,
    ...REPLACEMENT_PRIORITY[level],
    riskScore: Math.round(risk),
    estimatedRemainingUsefulLife: round2(healthAdjustedRemaining),
  };
}

function buildAssetMetrics(asset, issueCount = 0, openIssueCount = 0) {
  const cost = typeof asset.cost === 'number' ? asset.cost : (parseFloat(asset.cost) || 0);
  const category = asset.category || 'Other';
  const ageYears = calculateAssetAge(asset.purchaseDate);
  const config = getCategoryConfig(category);
  const maintenanceCount = asset.maintenanceHistory?.length || (asset.maintenanceStartDate ? 1 : 0);

  const slm = calculateSLM(cost, ageYears, config);
  const wdv = calculateWDV(cost, ageYears, config);
  const healthScore = calculateHealthScore(asset, ageYears, issueCount, openIssueCount, maintenanceCount);
  const replacement = calculateReplacementPriority(
    asset, healthScore, ageYears, issueCount, openIssueCount, maintenanceCount, config
  );

  return {
    assetId: asset._id,
    assetIdString: asset.assetId,
    name: asset.name,
    category,
    location: asset.locationId?.name,
    department: asset.departmentId?.name,
    purchaseDate: asset.purchaseDate,
    warrantyExpiry: asset.warrantyExpiry,
    status: asset.status,
    condition: asset.condition || 'good',
    ageYears: round2(ageYears),
    slm,
    wdv,
    operational: {
      healthScore,
      healthLabel: healthLabel(healthScore),
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
    },
    // Legacy fields for backward compatibility
    originalCost: slm.purchaseCost,
    currentValue: slm.currentBookValue,
    depreciation: slm.totalDepreciation,
    depreciationPercentage: slm.depreciationPercentage,
  };
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
          $sum: {
            $cond: [{ $in: ['$status', ['open', 'in_progress']] }, 1, 0],
          },
        },
      },
    },
  ]);

  const map = new Map();
  for (const row of stats) {
    map.set(String(row._id), {
      issueCount: row.issueCount,
      openIssueCount: row.openIssueCount,
    });
  }
  return map;
}

export async function calculateAssetMetrics(assetId) {
  const asset = await Asset.findById(assetId)
    .populate('locationId', 'name')
    .populate('departmentId', 'name')
    .lean();

  if (!asset) throw new Error('Asset not found');

  const issueStats = await fetchIssueCountsByAsset([asset._id]);
  const counts = issueStats.get(String(asset._id)) || { issueCount: 0, openIssueCount: 0 };

  return buildAssetMetrics(asset, counts.issueCount, counts.openIssueCount);
}

export async function calculateOrganizationMetrics(organizationId) {
  const assets = await Asset.find({ organizationId })
    .populate('locationId', 'name')
    .populate('departmentId', 'name')
    .lean();

  const assetIds = assets.map((asset) => asset._id);
  const issueStats = await fetchIssueCountsByAsset(assetIds);

  const results = [];

  let totalPurchaseValue = 0;
  let totalBookValueSLM = 0;
  let totalBookValueWDV = 0;
  let totalHealth = 0;
  let assetsNeedingReplacement = 0;
  let assetsUnderWarranty = 0;
  let warrantiesExpiringSoon = 0;

  for (const asset of assets) {
    try {
      const counts = issueStats.get(String(asset._id)) || { issueCount: 0, openIssueCount: 0 };
      const metrics = buildAssetMetrics(asset, counts.issueCount, counts.openIssueCount);
      results.push(metrics);

      totalPurchaseValue += metrics.slm.purchaseCost;
      totalBookValueSLM += metrics.slm.currentBookValue;
      totalBookValueWDV += metrics.wdv.currentBookValue;
      totalHealth += metrics.operational.healthScore;

      if (['high', 'critical'].includes(metrics.operational.replacementPriority)) {
        assetsNeedingReplacement++;
      }
      if (metrics.operational.warrantyActive) assetsUnderWarranty++;
      if (metrics.operational.warrantyExpiringSoon) warrantiesExpiringSoon++;
    } catch (err) {
      console.error(`Metrics error for asset ${asset.assetId}:`, err.message);
    }
  }

  const count = results.length;
  const avgHealth = count > 0 ? round2(totalHealth / count) : 0;

  return {
    assets: results,
    summary: {
      totalAssets: count,
      totalPurchaseValue: round2(totalPurchaseValue),
      currentBookValueSLM: round2(totalBookValueSLM),
      currentBookValueWDV: round2(totalBookValueWDV),
      totalDepreciationSLM: round2(totalPurchaseValue - totalBookValueSLM),
      totalDepreciationWDV: round2(totalPurchaseValue - totalBookValueWDV),
      averageAssetHealth: avgHealth,
      assetsNeedingReplacement,
      assetsUnderWarranty,
      warrantiesExpiringSoon,
      // Legacy
      totalOriginalValue: round2(totalPurchaseValue),
      totalCurrentValue: round2(totalBookValueSLM),
      totalDepreciation: round2(totalPurchaseValue - totalBookValueSLM),
      averageDepreciationPercentage: totalPurchaseValue > 0
        ? round2(((totalPurchaseValue - totalBookValueSLM) / totalPurchaseValue) * 100)
        : 0,
    },
  };
}

export async function getDepreciationByCategory(organizationId) {
  const result = await calculateOrganizationMetrics(organizationId);
  const categoryMap = {};

  result.assets.forEach((asset) => {
    const cat = asset.category || 'Uncategorized';
    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        category: cat,
        count: 0,
        purchaseValue: 0,
        bookValueSLM: 0,
        bookValueWDV: 0,
        totalHealth: 0,
        needingReplacement: 0,
      };
    }
    const c = categoryMap[cat];
    c.count++;
    c.purchaseValue += asset.slm.purchaseCost;
    c.bookValueSLM += asset.slm.currentBookValue;
    c.bookValueWDV += asset.wdv.currentBookValue;
    c.totalHealth += asset.operational.healthScore;
    if (['high', 'critical'].includes(asset.operational.replacementPriority)) {
      c.needingReplacement++;
    }
  });

  const categories = Object.values(categoryMap).map((cat) => ({
    ...cat,
    purchaseValue: round2(cat.purchaseValue),
    bookValueSLM: round2(cat.bookValueSLM),
    bookValueWDV: round2(cat.bookValueWDV),
    averageHealth: cat.count > 0 ? round2(cat.totalHealth / cat.count) : 0,
    depreciationSLM: round2(cat.purchaseValue - cat.bookValueSLM),
    depreciationPercentage: cat.purchaseValue > 0
      ? round2(((cat.purchaseValue - cat.bookValueSLM) / cat.purchaseValue) * 100)
      : 0,
    // Legacy
    originalValue: round2(cat.purchaseValue),
    currentValue: round2(cat.bookValueSLM),
    depreciation: round2(cat.purchaseValue - cat.bookValueSLM),
  }));

  return { categories, summary: result.summary };
}

// Legacy exports
export async function calculateAssetDepreciation(assetId) {
  return calculateAssetMetrics(assetId);
}

export async function calculateOrganizationDepreciation(organizationId) {
  return calculateOrganizationMetrics(organizationId);
}

export const DEPRECIATION_CONFIG = { CATEGORY_CONFIG, REPLACEMENT_PRIORITY };
