import mongoose from 'mongoose';
import {
  DepreciationPolicy,
  DepreciationPolicyAssignment,
  Asset,
  AssetGroup,
} from '../models/index.js';
import { DEFAULT_DEPRECIATION_POLICIES } from '../constants/depreciationPolicyDefaults.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from './auditService.js';

function normalizeYearRates(yearRates, fallbackRate) {
  if (!Array.isArray(yearRates) || yearRates.length === 0) return [];
  const seen = new Set();
  const normalized = [];
  for (const row of yearRates) {
    const year = Number(row?.year);
    const rate = Number(row?.rate);
    if (!Number.isInteger(year) || year < 1) continue;
    if (Number.isNaN(rate) || rate < 0 || rate > 100) continue;
    if (seen.has(year)) continue;
    seen.add(year);
    normalized.push({ year, rate });
  }
  normalized.sort((a, b) => a.year - b.year);
  if (!normalized.length && fallbackRate != null) {
    return [{ year: 1, rate: Number(fallbackRate) }];
  }
  return normalized;
}

export async function findOrgAsset(organizationId, identifier) {
  const key = String(identifier || '').trim();
  if (!key) return null;
  if (mongoose.Types.ObjectId.isValid(key)) {
    const byMongo = await Asset.findOne({ organizationId, _id: key });
    if (byMongo) return byMongo;
  }
  return Asset.findOne({
    organizationId,
    assetId: new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
}

export function getRateForDepreciationYear(policy, yearIndex, overrideRate) {
  if (overrideRate != null && overrideRate !== '') return Number(overrideRate);
  if (!policy) return 0;
  const schedule = policy.yearRates || [];
  const entry = schedule.find((r) => r.year === yearIndex);
  if (entry) return Number(entry.rate);
  return Number(policy.rate) || 0;
}

export async function ensureDefaultDepreciationPolicies(organizationId, userId) {
  const count = await DepreciationPolicy.countDocuments({ organizationId });
  if (count > 0) return DepreciationPolicy.find({ organizationId }).lean();

  const groups = await AssetGroup.find({ organizationId }).lean();
  const groupByKey = Object.fromEntries(groups.filter((g) => g.key).map((g) => [g.key, g._id]));

  const created = [];
  for (const def of DEFAULT_DEPRECIATION_POLICIES) {
    const policy = await DepreciationPolicy.create({
      organizationId,
      name: def.name,
      method: def.method,
      rate: def.rate,
      yearRates: def.yearRates || [],
      residualPct: def.residualPct ?? 5,
      isOrgDefault: Boolean(def.isOrgDefault),
      description: def.description || '',
      createdBy: userId,
      updatedBy: userId,
    });
    created.push(policy);

    if (def.groupKey && groupByKey[def.groupKey]) {
      await DepreciationPolicyAssignment.create({
        organizationId,
        policyId: policy._id,
        targetType: 'group',
        targetId: groupByKey[def.groupKey],
      });
    }
    if (def.categoryNames?.length) {
      for (const category of def.categoryNames) {
        await DepreciationPolicyAssignment.updateOne(
          { organizationId, targetType: 'category', targetKey: category },
          { organizationId, policyId: policy._id, targetType: 'category', targetKey: category },
          { upsert: true }
        );
      }
    }
  }

  return created;
}

export function buildPolicyContext(policies, assignments) {
  const policyById = Object.fromEntries(policies.map((p) => [String(p._id), p]));
  const orgDefault = policies.find((p) => p.isOrgDefault) || policies[0] || null;
  const byGroup = new Map();
  const byCategory = new Map();
  for (const a of assignments) {
    if (a.targetType === 'group' && a.targetId) {
      byGroup.set(String(a.targetId), policyById[String(a.policyId)]);
    }
    if (a.targetType === 'category' && a.targetKey) {
      byCategory.set(a.targetKey, policyById[String(a.policyId)]);
    }
  }
  return { policyById, orgDefault, byGroup, byCategory };
}

/** Priority: Category → Asset group → Organization default */
export function resolvePolicyForAsset(asset, ctx) {
  const category = asset.category?.trim();
  if (category && ctx.byCategory.has(category)) {
    return { policy: ctx.byCategory.get(category), source: 'category' };
  }

  const groupId = asset.groupId?._id || asset.groupId;
  if (groupId && ctx.byGroup.has(String(groupId))) {
    return { policy: ctx.byGroup.get(String(groupId)), source: 'group' };
  }

  if (ctx.orgDefault) return { policy: ctx.orgDefault, source: 'org_default' };
  return { policy: null, source: 'none' };
}

export function effectiveRate(asset, policy) {
  if (!policy) return null;
  if (asset.depreciationRateOverride != null && asset.depreciationRateOverride !== '') {
    return Number(asset.depreciationRateOverride);
  }
  const ageYears = asset.purchaseDate
    ? Math.max(0, (Date.now() - new Date(asset.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : 0;
  const currentYear = Math.max(1, Math.floor(ageYears) + 1);
  return getRateForDepreciationYear(policy, currentYear, null);
}

export async function loadPolicyContext(organizationId, userId) {
  await ensureDefaultDepreciationPolicies(organizationId, userId);
  const [policies, assignments] = await Promise.all([
    DepreciationPolicy.find({ organizationId }).sort({ isOrgDefault: -1, name: 1 }).lean(),
    DepreciationPolicyAssignment.find({ organizationId }).lean(),
  ]);
  return buildPolicyContext(policies, assignments);
}

export async function listPolicies(organizationId, userId) {
  await ensureDefaultDepreciationPolicies(organizationId, userId);
  const [policies, assignments, categories] = await Promise.all([
    DepreciationPolicy.find({ organizationId }).sort({ name: 1 }).lean(),
    DepreciationPolicyAssignment.find({ organizationId })
      .populate('policyId', 'name method rate')
      .lean(),
    Asset.distinct('category', { organizationId }),
  ]);
  return {
    policies,
    assignments,
    categories: categories.filter(Boolean).sort(),
  };
}

export async function createPolicy(organizationId, userId, body) {
  const name = String(body.name || '').trim();
  if (!name) throw new Error('Policy name is required');
  if (!['SLM', 'WDV'].includes(body.method)) throw new Error('Method must be SLM or WDV');
  const rate = Number(body.rate);
  if (Number.isNaN(rate) || rate < 0 || rate > 100) throw new Error('Rate must be between 0 and 100');
  const yearRates = normalizeYearRates(body.yearRates, rate);

  const dup = await DepreciationPolicy.findOne({ organizationId, name });
  if (dup) throw new Error('A policy with this name already exists');

  if (body.isOrgDefault) {
    await DepreciationPolicy.updateMany({ organizationId }, { isOrgDefault: false });
  }

  return DepreciationPolicy.create({
    organizationId,
    name,
    method: body.method,
    rate,
    yearRates,
    residualPct: body.residualPct != null ? Number(body.residualPct) : 5,
    isOrgDefault: Boolean(body.isOrgDefault),
    description: String(body.description || '').trim(),
    createdBy: userId,
    updatedBy: userId,
  });
}

export async function updatePolicy(organizationId, userId, policyId, body) {
  const policy = await DepreciationPolicy.findOne({ _id: policyId, organizationId });
  if (!policy) throw new Error('Policy not found');

  if (body.name?.trim() && body.name.trim() !== policy.name) {
    const dup = await DepreciationPolicy.findOne({
      organizationId,
      name: body.name.trim(),
      _id: { $ne: policyId },
    });
    if (dup) throw new Error('A policy with this name already exists');
    policy.name = body.name.trim();
  }
  if (body.method && ['SLM', 'WDV'].includes(body.method)) policy.method = body.method;
  if (body.rate != null) {
    const rate = Number(body.rate);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) throw new Error('Invalid rate');
    policy.rate = rate;
  }
  if (body.yearRates != null) {
    policy.yearRates = normalizeYearRates(body.yearRates, policy.rate);
  }
  if (body.residualPct != null) policy.residualPct = Number(body.residualPct);
  if (body.description != null) policy.description = String(body.description).trim();
  if (body.isOrgDefault === true) {
    await DepreciationPolicy.updateMany({ organizationId }, { isOrgDefault: false });
    policy.isOrgDefault = true;
  }
  policy.updatedBy = userId;
  await policy.save();
  return policy;
}

export async function deletePolicy(organizationId, policyId) {
  const policy = await DepreciationPolicy.findOne({ _id: policyId, organizationId });
  if (!policy) throw new Error('Policy not found');
  if (policy.isOrgDefault) throw new Error('Cannot delete the organization default policy');

  await DepreciationPolicyAssignment.deleteMany({ organizationId, policyId });
  await policy.deleteOne();
  return { message: 'Policy deleted' };
}

export async function setAssignment(organizationId, { policyId, targetType, targetId, targetKey }) {
  if (!['group', 'category'].includes(targetType)) throw new Error('Invalid target type');
  const policy = await DepreciationPolicy.findOne({ _id: policyId, organizationId });
  if (!policy) throw new Error('Invalid policy');

  if (targetType === 'group') {
    if (!targetId) throw new Error('Group is required');
    await DepreciationPolicyAssignment.findOneAndUpdate(
      { organizationId, targetType: 'group', targetId },
      { organizationId, policyId, targetType: 'group', targetId, targetKey: null },
      { upsert: true, new: true }
    );
  } else {
    const category = String(targetKey || targetId || '').trim();
    if (!category) throw new Error('Category is required');
    await DepreciationPolicyAssignment.findOneAndUpdate(
      { organizationId, targetType: 'category', targetKey: category },
      { organizationId, policyId, targetType: 'category', targetKey: category, targetId: null },
      { upsert: true, new: true }
    );
  }
  return { message: 'Assignment saved' };
}

export async function removeAssignment(organizationId, targetType, targetRef) {
  if (targetType === 'category') {
    await DepreciationPolicyAssignment.deleteOne({
      organizationId,
      targetType: 'category',
      targetKey: decodeURIComponent(targetRef),
    });
  } else {
    await DepreciationPolicyAssignment.deleteOne({
      organizationId,
      targetType: 'group',
      targetId: targetRef,
    });
  }
  return { message: 'Assignment removed' };
}

export async function setAssetOverride(req, assetIdentifier, { rateOverride, reason, clear }) {
  const asset = await findOrgAsset(req.user.organizationId, assetIdentifier);
  if (!asset) throw new Error('Asset not found');

  const prevRate = asset.depreciationRateOverride;
  const prevReason = asset.depreciationOverrideReason;

  if (clear) {
    asset.depreciationRateOverride = null;
    asset.depreciationOverrideReason = '';
  } else {
    const rate = Number(rateOverride);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) throw new Error('Rate must be between 0 and 100');
    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) throw new Error('Reason is required for manual override');
    asset.depreciationRateOverride = rate;
    asset.depreciationOverrideReason = trimmedReason;
  }

  await asset.save();

  await logAudit(
    req.user._id,
    AUDIT_ACTIONS.ASSET_UPDATED,
    AUDIT_RESOURCES.ASSET,
    asset._id,
    {
      resourceName: asset.name,
      description: clear
        ? `Cleared depreciation rate override on "${asset.name}"`
        : `Depreciation override on "${asset.name}": ${prevRate ?? 'policy'}% → ${asset.depreciationRateOverride}%`,
      details: {
        field: 'depreciationRateOverride',
        oldValue: prevRate,
        newValue: asset.depreciationRateOverride,
        reason: asset.depreciationOverrideReason || prevReason,
      },
      severity: 'medium',
      ...getRequestMetadata(req),
    }
  );

  return asset;
}
