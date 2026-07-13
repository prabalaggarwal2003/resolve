import {
  DEFAULT_FACTOR_THRESHOLDS,
  DEFAULT_HEALTH_LEVELS,
  HEALTH_FACTOR_KEYS,
  CUSTOM_FACTOR_SOURCE_KEYS,
} from '../constants/assetHealthDefaults.js';

const HEALTH_FACTOR_LABELS = {
  age: 'Age',
  condition: 'Condition',
  issues: 'Open Issues',
  maintenance: 'Maintenance History',
  warranty: 'Warranty',
  audit: 'Audit Status',
  downtime: 'Downtime',
};

/** A factor is custom when it is not one of the builtin keys and is flagged custom. */
export function isCustomFactor(def) {
  return !!def && def.custom === true;
}

/** Full ordered list of factor keys = builtin factors + any custom factors defined in config. */
export function getAllFactorKeys(factors) {
  const keys = [...HEALTH_FACTOR_KEYS];
  if (factors && typeof factors === 'object') {
    for (const key of Object.keys(factors)) {
      if (!keys.includes(key) && isCustomFactor(factors[key])) keys.push(key);
    }
  }
  return keys;
}

export function getFactorLabel(key, factors) {
  const def = factors?.[key];
  if (isCustomFactor(def) && def.label) return def.label;
  return HEALTH_FACTOR_LABELS[key] || key;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function scoreFromRanges(value, ranges) {
  if (value == null || !Array.isArray(ranges)) return 50;
  for (const band of ranges) {
    const min = band.min ?? 0;
    const max = band.max;
    if (value >= min && (max == null || value < max)) return band.score;
  }
  return ranges[ranges.length - 1]?.score ?? 50;
}

function calculateAgeScore(ageYears, thresholds) {
  return scoreFromRanges(ageYears ?? 0, thresholds?.age || DEFAULT_FACTOR_THRESHOLDS.age);
}

function calculateConditionScore(condition, thresholds) {
  const map = thresholds?.condition || DEFAULT_FACTOR_THRESHOLDS.condition;
  return map[condition] ?? map.good ?? 85;
}

function calculateIssuesScore(openIssueCount, thresholds) {
  return scoreFromRanges(openIssueCount ?? 0, thresholds?.issues || DEFAULT_FACTOR_THRESHOLDS.issues);
}

function calculateMaintenanceScore(maintenanceCount, thresholds) {
  return scoreFromRanges(maintenanceCount ?? 0, thresholds?.maintenance || DEFAULT_FACTOR_THRESHOLDS.maintenance);
}

function calculateWarrantyScore(warrantyExpiry, thresholds) {
  const cfg = thresholds?.warranty || DEFAULT_FACTOR_THRESHOLDS.warranty;
  if (!warrantyExpiry) return cfg.none ?? 70;
  const now = Date.now();
  const expiry = new Date(warrantyExpiry).getTime();
  if (expiry >= now) {
    const daysLeft = (expiry - now) / MS_PER_DAY;
    if (daysLeft <= 30) return cfg.expiresIn30Days ?? 80;
    return cfg.active ?? 100;
  }
  const daysExpired = (now - expiry) / MS_PER_DAY;
  if (daysExpired > 365) return cfg.expiredOver1Year ?? 20;
  return cfg.expired ?? 50;
}

function calculateAuditScore(daysSinceLastAudit, thresholds) {
  const days = daysSinceLastAudit ?? 999;
  return scoreFromRanges(days, thresholds?.audit || DEFAULT_FACTOR_THRESHOLDS.audit);
}

function calculateDowntimeScore(status, thresholds) {
  const map = thresholds?.downtime || DEFAULT_FACTOR_THRESHOLDS.downtime;
  return map[status] ?? map.available ?? 100;
}

export function resolveEffectiveConfig(orgConfig, profile) {
  const base = orgConfig || {};
  const factors = { ...(base.factors || {}) };
  const thresholds = JSON.parse(JSON.stringify(base.thresholds || DEFAULT_FACTOR_THRESHOLDS));

  if (profile?.enabled) {
    if (profile.factors && typeof profile.factors === 'object') {
      // Merge per-key so custom-factor metadata (custom/label/source) from the
      // org config is preserved while the profile overrides enabled/weight.
      for (const key of Object.keys(profile.factors)) {
        if (profile.factors[key]) {
          factors[key] = { ...factors[key], ...profile.factors[key] };
        }
      }
    }
    if (profile.thresholds && typeof profile.thresholds === 'object') {
      for (const [key, val] of Object.entries(profile.thresholds)) {
        thresholds[key] = val;
      }
    }
  }

  return { factors, thresholds, healthLevels: base.healthLevels || DEFAULT_HEALTH_LEVELS };
}

function calculateCustomFactorScore(def, input, thresholds, key) {
  const source = def?.source;
  if (!source || !CUSTOM_FACTOR_SOURCE_KEYS.includes(source)) return 50;
  const value = Number(input?.[source] ?? 0);
  return scoreFromRanges(value, thresholds?.[key]);
}

export function computeFactorScores(input, thresholds, factors = {}) {
  const scores = {
    age: calculateAgeScore(input.ageYears, thresholds),
    condition: calculateConditionScore(input.condition, thresholds),
    issues: calculateIssuesScore(input.openIssueCount, thresholds),
    maintenance: calculateMaintenanceScore(input.maintenanceCount, thresholds),
    warranty: calculateWarrantyScore(input.warrantyExpiry, thresholds),
    audit: calculateAuditScore(input.daysSinceLastAudit, thresholds),
    downtime: calculateDowntimeScore(input.status, thresholds),
  };
  for (const key of Object.keys(factors || {})) {
    if (isCustomFactor(factors[key])) {
      scores[key] = calculateCustomFactorScore(factors[key], input, thresholds, key);
    }
  }
  return scores;
}

export function calculateWeightedHealthScore(factorScores, factors) {
  const enabled = getAllFactorKeys(factors).filter((k) => factors?.[k]?.enabled !== false);
  if (!enabled.length) return 100;

  let totalWeight = 0;
  let weightedSum = 0;
  for (const key of enabled) {
    const weight = Number(factors[key]?.weight) || 0;
    if (weight <= 0) continue;
    totalWeight += weight;
    weightedSum += (factorScores[key] ?? 0) * weight;
  }

  if (totalWeight <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)));
}

export function getHealthLevel(score, healthLevels = DEFAULT_HEALTH_LEVELS) {
  const levels = [...healthLevels].sort((a, b) => b.min - a.min);
  for (const level of levels) {
    if (score >= level.min && score <= level.max) return level;
  }
  return levels[levels.length - 1] || DEFAULT_HEALTH_LEVELS[DEFAULT_HEALTH_LEVELS.length - 1];
}

export function scoreToCondition(score, healthLevels = DEFAULT_HEALTH_LEVELS) {
  const level = getHealthLevel(score, healthLevels);
  const key = level.key;
  if (['excellent', 'good', 'fair', 'poor', 'critical'].includes(key)) return key;
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}

export function healthLabel(score, healthLevels = DEFAULT_HEALTH_LEVELS) {
  return getHealthLevel(score, healthLevels).label;
}

export function validateFactorWeights(factors) {
  const enabled = getAllFactorKeys(factors).filter((k) => factors?.[k]?.enabled !== false);
  const total = enabled.reduce((sum, k) => sum + (Number(factors[k]?.weight) || 0), 0);
  if (enabled.length && total !== 100) {
    return { ok: false, message: `Enabled factor weights must total 100% (currently ${total}%)` };
  }
  return { ok: true };
}

export function buildHealthScoreResult(input, orgConfig, profile = null) {
  const { factors, thresholds, healthLevels } = resolveEffectiveConfig(orgConfig, profile);
  const factorScores = computeFactorScores(input, thresholds, factors);
  const score = calculateWeightedHealthScore(factorScores, factors);
  const level = getHealthLevel(score, healthLevels);

  const breakdown = {};
  for (const key of getAllFactorKeys(factors)) {
    const enabled = factors[key]?.enabled !== false;
    breakdown[key] = {
      enabled,
      custom: isCustomFactor(factors[key]),
      label: getFactorLabel(key, factors),
      weight: factors[key]?.weight ?? 0,
      score: factorScores[key],
      contribution: enabled
        ? Math.round((factorScores[key] * (factors[key]?.weight || 0)) / 100)
        : 0,
    };
  }

  return {
    healthScore: score,
    healthLabel: level.label,
    healthLevel: level.key,
    healthEmoji: level.emoji,
    factorScores,
    breakdown,
    recommendedCondition: scoreToCondition(score, healthLevels),
    profileId: profile?._id ? String(profile._id) : null,
    profileName: profile?.name || null,
  };
}

export {
  calculateAgeScore,
  calculateConditionScore,
  calculateIssuesScore,
  calculateMaintenanceScore,
  calculateWarrantyScore,
  calculateAuditScore,
  calculateDowntimeScore,
};
