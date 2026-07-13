import AssetHealthOrgConfig from '../models/AssetHealthOrgConfig.js';
import AssetHealthProfile from '../models/AssetHealthProfile.js';
import {
  DEFAULT_ASSET_HEALTH_CONFIG,
  getDefaultAutomationRules,
  getDefaultFactorWeights,
  HEALTH_FACTOR_KEYS,
  CUSTOM_FACTOR_SOURCE_KEYS,
} from '../constants/assetHealthDefaults.js';
import { validateFactorWeights } from './assetHealthScoreService.js';

/** Normalise incoming factor config: keep builtin factors, validate custom factor metadata. */
function sanitizeFactors(factors) {
  if (!factors || typeof factors !== 'object') return factors;
  const clean = {};
  for (const [key, def] of Object.entries(factors)) {
    if (!def || typeof def !== 'object') continue;
    const base = {
      enabled: def.enabled !== false,
      weight: Math.max(0, Math.min(100, Number(def.weight) || 0)),
    };
    if (def.custom === true) {
      const source = CUSTOM_FACTOR_SOURCE_KEYS.includes(def.source) ? def.source : CUSTOM_FACTOR_SOURCE_KEYS[0];
      clean[key] = {
        ...base,
        custom: true,
        label: String(def.label || 'Custom factor').slice(0, 60),
        source,
      };
    } else {
      clean[key] = base;
    }
  }
  return clean;
}

/** Remove threshold entries for custom factors that no longer exist in the factor config. */
function pruneOrphanThresholds(thresholds, factors) {
  if (!thresholds || typeof thresholds !== 'object' || !factors) return thresholds;
  const validCustomKeys = new Set(
    Object.keys(factors).filter((k) => factors[k]?.custom === true)
  );
  const out = {};
  for (const [key, val] of Object.entries(thresholds)) {
    if (HEALTH_FACTOR_KEYS.includes(key) || validCustomKeys.has(key)) {
      out[key] = val;
    }
  }
  return out;
}

function deepMergeThresholds(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  for (const [key, val] of Object.entries(patch)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = { ...out[key], ...val };
    } else {
      out[key] = val;
    }
  }
  return out;
}

function mergeBuiltinRules(existing) {
  const rules = Array.isArray(existing) ? [...existing] : [];
  const keys = new Set(rules.map((r) => r.ruleKey));
  for (const builtin of getDefaultAutomationRules()) {
    if (!keys.has(builtin.ruleKey)) rules.push(builtin);
  }
  return rules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function ensureAssetHealthOrgConfig(organizationId) {
  let config = await AssetHealthOrgConfig.findOne({ organizationId }).lean();
  if (!config) {
    config = (
      await AssetHealthOrgConfig.create({
        organizationId,
        ...DEFAULT_ASSET_HEALTH_CONFIG,
        seededAt: new Date(),
      })
    ).toObject();
  } else {
    const updates = {};
    if (!config.factors) updates.factors = getDefaultFactorWeights();
    if (!config.thresholds) updates.thresholds = DEFAULT_ASSET_HEALTH_CONFIG.thresholds;
    if (!config.healthLevels) updates.healthLevels = DEFAULT_ASSET_HEALTH_CONFIG.healthLevels;
    const mergedRules = mergeBuiltinRules(config.automationRules);
    if (JSON.stringify(mergedRules) !== JSON.stringify(config.automationRules)) {
      updates.automationRules = mergedRules;
    }
    if (Object.keys(updates).length) {
      await AssetHealthOrgConfig.updateOne({ organizationId }, { $set: updates });
      config = { ...config, ...updates };
    }
  }
  return config;
}

export async function getAssetHealthOrgConfig(organizationId) {
  return ensureAssetHealthOrgConfig(organizationId);
}

export async function updateAssetHealthOrgConfig(organizationId, userId, body) {
  const current = await ensureAssetHealthOrgConfig(organizationId);
  const update = { updatedBy: userId };

  if (body.factors) {
    const factors = sanitizeFactors(body.factors);
    const validation = validateFactorWeights(factors);
    if (!validation.ok) {
      const err = new Error(validation.message);
      err.status = 400;
      throw err;
    }
    update.factors = factors;
  }
  if (body.thresholds) {
    update.thresholds = deepMergeThresholds(current.thresholds, body.thresholds);
  }
  // Drop threshold bands for custom factors that were removed in this update.
  const effectiveFactors = update.factors || current.factors;
  if (update.thresholds || update.factors) {
    update.thresholds = pruneOrphanThresholds(update.thresholds || current.thresholds, effectiveFactors);
  }
  if (body.healthLevels) update.healthLevels = body.healthLevels;
  if (body.automationRules) update.automationRules = body.automationRules;
  if (body.autoUpdateCondition != null) update.autoUpdateCondition = !!body.autoUpdateCondition;
  if (body.defaultNewAssetCondition) {
    if (!['excellent', 'good'].includes(body.defaultNewAssetCondition)) {
      const err = new Error('defaultNewAssetCondition must be excellent or good');
      err.status = 400;
      throw err;
    }
    update.defaultNewAssetCondition = body.defaultNewAssetCondition;
  }

  return AssetHealthOrgConfig.findOneAndUpdate(
    { organizationId },
    { $set: update },
    { new: true }
  ).lean();
}

export async function listAssetHealthProfiles(organizationId) {
  await ensureAssetHealthOrgConfig(organizationId);
  return AssetHealthProfile.find({ organizationId }).sort({ order: 1, name: 1 }).lean();
}

export async function getAssetHealthProfile(organizationId, id) {
  return AssetHealthProfile.findOne({ organizationId, _id: id }).lean();
}

/**
 * Profiles only carry per-key weight/enabled overrides. To validate totals we
 * merge them over the org factor config so custom factors are counted too.
 */
function mergeProfileFactorsForValidation(orgFactors, profileFactors) {
  const merged = { ...(orgFactors || {}) };
  for (const [key, def] of Object.entries(profileFactors || {})) {
    merged[key] = { ...(orgFactors?.[key] || {}), ...def };
  }
  return merged;
}

export async function createAssetHealthProfile(organizationId, userId, body) {
  if (!body.name?.trim()) {
    const err = new Error('Profile name is required');
    err.status = 400;
    throw err;
  }
  if (body.factors) {
    const orgConfig = await ensureAssetHealthOrgConfig(organizationId);
    const validation = validateFactorWeights(
      mergeProfileFactorsForValidation(orgConfig.factors, body.factors)
    );
    if (!validation.ok) {
      const err = new Error(validation.message);
      err.status = 400;
      throw err;
    }
  }
  const maxOrder = await AssetHealthProfile.findOne({ organizationId }).sort({ order: -1 }).select('order').lean();
  return (
    await AssetHealthProfile.create({
      organizationId,
      name: body.name.trim(),
      description: body.description || '',
      groupId: body.groupId || null,
      enabled: body.enabled !== false,
      factors: body.factors || {},
      thresholds: body.thresholds || {},
      order: (maxOrder?.order ?? 0) + 1,
      updatedBy: userId,
    })
  ).toObject();
}

export async function updateAssetHealthProfile(organizationId, userId, id, body) {
  const profile = await AssetHealthProfile.findOne({ organizationId, _id: id });
  if (!profile) {
    const err = new Error('Health profile not found');
    err.status = 404;
    throw err;
  }
  if (body.name != null) profile.name = body.name.trim();
  if (body.description != null) profile.description = body.description;
  if (body.groupId !== undefined) profile.groupId = body.groupId || null;
  if (body.enabled != null) profile.enabled = !!body.enabled;
  if (body.factors) {
    const orgConfig = await ensureAssetHealthOrgConfig(organizationId);
    const validation = validateFactorWeights(
      mergeProfileFactorsForValidation(orgConfig.factors, body.factors)
    );
    if (!validation.ok) {
      const err = new Error(validation.message);
      err.status = 400;
      throw err;
    }
    profile.factors = body.factors;
  }
  if (body.thresholds) profile.thresholds = body.thresholds;
  if (body.order != null) profile.order = body.order;
  profile.updatedBy = userId;
  await profile.save();
  return profile.toObject();
}

export async function deleteAssetHealthProfile(organizationId, id) {
  const result = await AssetHealthProfile.deleteOne({ organizationId, _id: id });
  if (!result.deletedCount) {
    const err = new Error('Health profile not found');
    err.status = 404;
    throw err;
  }
  return { ok: true };
}

export async function resolveProfileForAsset(organizationId, groupId) {
  if (!groupId) return null;
  return AssetHealthProfile.findOne({
    organizationId,
    groupId,
    enabled: true,
  }).lean();
}

export async function resetAutomationRule(organizationId, userId, ruleKey) {
  const config = await ensureAssetHealthOrgConfig(organizationId);
  const defaults = getDefaultAutomationRules();
  const def = defaults.find((r) => r.ruleKey === ruleKey);
  if (!def) {
    const err = new Error('Built-in rule not found');
    err.status = 404;
    throw err;
  }
  const rules = (config.automationRules || []).map((r) =>
    r.ruleKey === ruleKey ? { ...def } : r
  );
  if (!rules.some((r) => r.ruleKey === ruleKey)) rules.push(def);
  return updateAssetHealthOrgConfig(organizationId, userId, { automationRules: rules });
}
