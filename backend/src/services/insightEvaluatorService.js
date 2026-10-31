import mongoose from 'mongoose';
import { Asset, Issue, AssetLog, BusinessPartner, Invoice, PartnerContract } from '../models/index.js';
import { getKpiSummary } from './kpiSummaryService.js';
import { getBudgetAnalyticsSummary } from './budgetSummaryService.js';
import { countPendingProcurements } from './budgetRollupService.js';
import { ensureInsightOrgConfig } from './insightOrgConfigService.js';
import { listInsightRules } from './insightOrgConfigService.js';
import { daysUntilWarrantyExpiry } from '../utils/warrantyStatus.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from, to = new Date()) {
  if (!from) return null;
  return Math.floor((new Date(from) - to) / MS_PER_DAY);
}

function daysUntil(date, from = new Date()) {
  if (!date) return null;
  return Math.floor((new Date(date) - from) / MS_PER_DAY);
}

function resolveConditionValue(condition, thresholds) {
  if (condition.thresholdKey && thresholds[condition.thresholdKey] != null) {
    return thresholds[condition.thresholdKey];
  }
  return condition.value;
}

function compareValues(actual, operator, expected) {
  if (actual == null && operator !== 'empty' && operator !== 'not_empty') return false;

  switch (operator) {
    case 'eq':
      return String(actual) === String(expected);
    case 'ne':
      return String(actual) !== String(expected);
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'contains':
      return String(actual).toLowerCase().includes(String(expected).toLowerCase());
    case 'in':
      return Array.isArray(expected) ? expected.map(String).includes(String(actual)) : false;
    case 'empty':
      return actual == null || actual === '' || actual === false;
    case 'not_empty':
      return actual != null && actual !== '' && actual !== false;
    default:
      return false;
  }
}

function evaluateGroup(group, getMetric, thresholds) {
  if (!group?.conditions?.length) return false;
  const results = group.conditions.map((c) => {
    const expected = resolveConditionValue(c, thresholds);
    const actual = getMetric(c.metric);
    return compareValues(actual, c.operator, expected);
  });
  return group.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
}

export function evaluateConditionTree(tree, getMetric, thresholds) {
  if (!tree?.groups?.length) return false;
  const groupResults = tree.groups.map((g) => evaluateGroup(g, getMetric, thresholds));
  return tree.rootLogic === 'or' ? groupResults.some(Boolean) : groupResults.every(Boolean);
}

function formatMessage(template, vars) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (vars[key] != null) return String(vars[key]);
    return '';
  });
}

async function buildAssetContext(organizationId) {
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const now = new Date();

  const [kpiData, rawAssets, criticalIssues, lastScans, lastAudits] = await Promise.all([
    getKpiSummary(organizationId, null),
    Asset.find({ organizationId: orgId })
      .select('assignedTo assignedToName status cost maintenanceHistory warrantyExpiry amcExpiry nextMaintenanceDate updatedAt departmentId locationId category')
      .lean(),
    Issue.aggregate([
      { $match: { organizationId: orgId, status: { $in: ['open', 'new', 'triaged', 'assigned', 'in_progress', 'waiting'] }, severity: 'critical' } },
      { $group: { _id: '$assetId', count: { $sum: 1 } } },
    ]),
    AssetLog.aggregate([
      { $match: { type: { $in: ['check_in', 'check_out'] } } },
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
      { $group: { _id: '$assetId', lastScan: { $first: '$createdAt' } } },
    ]),
    AssetLog.aggregate([
      { $match: { type: { $in: ['check_in', 'check_out', 'edit'] } } },
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
    ]),
  ]);

  const kpiMap = Object.fromEntries((kpiData.assets || []).map((a) => [a.assetId, a]));
  const rawMap = Object.fromEntries(rawAssets.map((a) => [String(a._id), a]));
  const criticalMap = Object.fromEntries(criticalIssues.map((r) => [String(r._id), r.count]));
  const scanMap = Object.fromEntries(lastScans.map((r) => [String(r._id), r.lastScan]));
  const auditMap = Object.fromEntries(lastAudits.map((r) => [String(r._id), r.lastAudit]));

  return (kpiData.assets || []).map((kpi) => {
    const raw = rawMap[kpi.assetId] || {};
    const maintenanceEvents = raw.maintenanceHistory?.length || kpi.maintenanceCost || 0;
    const assetCost = Number(raw.cost) || kpi.purchaseValue || 0;
    const maintenanceCost = maintenanceEvents * Math.max(1000, assetCost * 0.05);

    return {
      assetId: kpi.assetId,
      assetIdString: kpi.assetIdString,
      name: kpi.name,
      departmentId: kpi.departmentId ? String(kpi.departmentId) : '',
      locationId: kpi.locationId ? String(kpi.locationId) : '',
      category: kpi.category || '',
      status: kpi.status,
      healthScore: kpi.healthScore,
      replacementScore: kpi.replacementScore,
      replacementPriority: kpi.replacementPriority,
      ageYears: kpi.ageYears,
      repairCount: maintenanceEvents,
      maintenanceCost,
      openIssueCount: kpi.openIssueCount,
      openCriticalIssueCount: criticalMap[kpi.assetId] || 0,
      warrantyDaysUntilExpiry: daysUntilWarrantyExpiry(raw.warrantyExpiry || kpi.warrantyExpiry, now),
      amcDaysUntilExpiry: daysUntilWarrantyExpiry(raw.amcExpiry, now),
      daysUntilMaintenance: daysUntil(raw.nextMaintenanceDate, now),
      daysSinceLastScan: scanMap[kpi.assetId]
        ? Math.abs(daysBetween(scanMap[kpi.assetId], now))
        : daysBetween(raw.updatedAt || kpi.createdAt, now) ?? 999,
      daysSinceLastAudit: auditMap[kpi.assetId]
        ? Math.abs(daysBetween(auditMap[kpi.assetId], now))
        : daysBetween(raw.updatedAt || kpi.createdAt, now) ?? 999,
      utilization: kpi.utilization,
      isAssigned: kpi.isAssigned ? 1 : 0,
      isActive: kpi.isActive ? 1 : 0,
      assetCost,
    };
  });
}

async function buildBudgetContext(organizationId) {
  try {
    const data = await getBudgetAnalyticsSummary(organizationId);
    return data.budgets || [];
  } catch {
    return [];
  }
}

async function buildOrgContext(organizationId) {
  const pendingProcurementCount = await countPendingProcurements(organizationId);
  return { pendingProcurementCount };
}

function resultBase(rule, count, message, items = []) {
  return {
    ruleId: String(rule._id),
    ruleKey: rule.ruleKey,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    severity: rule.severity,
    ruleType: rule.ruleType,
    enabled: rule.enabled,
    isBuiltin: rule.isBuiltin,
    createdAt: rule.createdAt ? new Date(rule.createdAt).toISOString() : null,
    count,
    message,
    link: rule.link,
    items,
  };
}

function evaluateAssetRule(rule, assets, thresholds) {
  const matches = assets.filter((asset) =>
    evaluateConditionTree(rule.conditionTree, (metric) => asset[metric], thresholds)
  );
  const count = matches.length;
  return resultBase(
    rule,
    count,
    formatMessage(rule.messageTemplate, {
      count,
      name: rule.name,
      days: thresholds.warrantyAlertDays,
      threshold: thresholds.repairCountThreshold,
      pct: thresholds.budgetUtilizationWarning,
    }),
    matches.slice(0, 10).map((a) => ({
      id: a.assetId,
      label: a.name,
      sublabel: a.assetIdString,
      meta: a.status ? String(a.status).replace(/_/g, ' ') : '',
    }))
  );
}

function evaluateBudgetRule(rule, budgets, thresholds) {
  const matches = budgets.filter((b) =>
    evaluateConditionTree(
      rule.conditionTree,
      (metric) => (metric === 'utilizationPct' ? b.utilizationPct : b[metric]),
      thresholds
    )
  );
  const count = matches.length;
  return resultBase(
    rule,
    count,
    formatMessage(rule.messageTemplate, {
      count,
      name: rule.name,
      pct: thresholds.budgetUtilizationWarning,
    }),
    matches.slice(0, 10).map((b) => ({
      id: b.id,
      label: b.name,
      sublabel: `${b.utilizationPct}% utilized`,
      meta: b.statusLabel,
    }))
  );
}

async function buildPartnerContext(organizationId) {
  const partners = await BusinessPartner.find({ organizationId }).lean();
  const orgOid = new mongoose.Types.ObjectId(organizationId);
  const now = new Date();

  return Promise.all(
    partners.map(async (p) => {
      const [invStats, assetCount, nearestContract] = await Promise.all([
        Invoice.aggregate([
          { $match: { organizationId: orgOid, $or: [{ partnerId: p._id }, { vendorId: p._id }] } },
          {
            $group: {
              _id: null,
              totalSpend: { $sum: '$totalAmount' },
              totalPaid: { $sum: '$paidAmount' },
            },
          },
        ]),
        Asset.countDocuments({ organizationId, $or: [{ partnerId: p._id }, { vendorId: p._id }] }),
        PartnerContract.findOne({
          partnerId: p._id,
          organizationId,
          status: { $in: ['Active', 'Draft'] },
          endDate: { $ne: null },
        })
          .sort({ endDate: 1 })
          .select('endDate')
          .lean(),
      ]);
      const totalSpend = invStats[0]?.totalSpend || 0;
      const pending = totalSpend - (invStats[0]?.totalPaid || 0);
      const expiringDays = nearestContract?.endDate ? daysUntil(nearestContract.endDate, now) : null;
      return {
        _id: p._id,
        partnerCode: p.partnerCode,
        name: p.name,
        partnerStatus: p.status,
        partnerIsInactive: p.status === 'Inactive' || p.status === 'Blacklisted',
        partnerPendingPayment: pending,
        partnerTotalSpend: totalSpend,
        partnerAssetCount: assetCount,
        partnerContractExpiringDays: expiringDays,
      };
    })
  );
}

function evaluatePartnerRule(rule, partners, thresholds) {
  const matches = partners.filter((partner) =>
    evaluateConditionTree(rule.conditionTree, (metric) => partner[metric], thresholds)
  );
  const count = matches.length;
  return resultBase(
    rule,
    count,
    formatMessage(rule.messageTemplate, {
      count,
      name: rule.name,
      days: thresholds.partnerContractAlertDays,
      threshold: thresholds.partnerPendingPaymentThreshold,
    }),
    matches.slice(0, 10).map((p) => ({
      id: p._id,
      label: p.name,
      sublabel: p.partnerCode,
      meta: p.partnerStatus || '',
    }))
  );
}

function evaluateAggregateRule(rule, orgCtx, thresholds) {
  const matches = evaluateConditionTree(
    rule.conditionTree,
    (metric) => orgCtx[metric],
    thresholds
  );
  const count = matches ? orgCtx.pendingProcurementCount || 1 : 0;
  return resultBase(
    rule,
    count,
    formatMessage(rule.messageTemplate, { count, name: rule.name }),
    []
  );
}

export async function getMatchingAssetIdsForRule(organizationId, ruleKey) {
  const [config, rules, assets] = await Promise.all([
    ensureInsightOrgConfig(organizationId),
    listInsightRules(organizationId),
    buildAssetContext(organizationId),
  ]);

  const rule = rules.find((r) => r.ruleKey === ruleKey);
  if (!rule) {
    const err = new Error('Insight rule not found');
    err.status = 404;
    throw err;
  }
  if (rule.ruleType !== 'asset') {
    return {
      ruleKey: rule.ruleKey,
      name: rule.name,
      ruleType: rule.ruleType,
      assetIds: [],
      count: 0,
    };
  }

  const thresholds = { ...config.thresholds };
  const matches = assets.filter((asset) =>
    evaluateConditionTree(rule.conditionTree, (metric) => asset[metric], thresholds)
  );

  return {
    ruleKey: rule.ruleKey,
    name: rule.name,
    ruleType: rule.ruleType,
    severity: rule.severity,
    assetIds: matches.map((a) => String(a.assetId)),
    count: matches.length,
  };
}

function ruleUsesRetiredHealthMetrics(rule) {
  const retired = new Set(['healthScore', 'replacementScore', 'replacementPriority']);
  const groups = rule?.conditionTree?.groups || [];
  for (const group of groups) {
    for (const condition of group.conditions || []) {
      if (retired.has(condition.metric)) return true;
    }
  }
  return false;
}

export async function evaluateInsights(organizationId) {
  const [config, rules, assets, budgets, orgCtx, partners] = await Promise.all([
    ensureInsightOrgConfig(organizationId),
    listInsightRules(organizationId),
    buildAssetContext(organizationId),
    buildBudgetContext(organizationId),
    buildOrgContext(organizationId),
    buildPartnerContext(organizationId),
  ]);

  const thresholds = {
    ...config.thresholds,
    partnerPendingPaymentThreshold: config.thresholds?.partnerPendingPaymentThreshold ?? 50000,
    partnerContractAlertDays: config.thresholds?.partnerContractAlertDays ?? 30,
  };
  const enabledRules = rules.filter((r) => r.enabled && !ruleUsesRetiredHealthMetrics(r));

  const results = enabledRules.map((rule) => {
    if (rule.ruleType === 'budget') return evaluateBudgetRule(rule, budgets, thresholds);
    if (rule.ruleType === 'partner') return evaluatePartnerRule(rule, partners, thresholds);
    if (rule.ruleType === 'aggregate' || rule.ruleType === 'org') {
      return evaluateAggregateRule(rule, orgCtx, thresholds);
    }
    return evaluateAssetRule(rule, assets, thresholds);
  });

  // Active matches always show. Custom rules also show when count is 0 so newly
  // added insights appear on Insights / Home instead of vanishing until data matches.
  const visible = results.filter((r) => r.count > 0 || !r.isBuiltin);
  const active = results.filter((r) => r.count > 0);
  const bySeverity = {
    critical: active.filter((r) => r.severity === 'critical'),
    warning: active.filter((r) => r.severity === 'warning'),
    info: active.filter((r) => r.severity === 'info'),
  };

  const createdMs = (r) => (r.createdAt ? new Date(r.createdAt).getTime() : 0);
  const sorted = visible.sort((a, b) => {
    // Newest first; among same timestamp prefer higher match counts / severity.
    const byCreated = createdMs(b) - createdMs(a);
    if (byCreated !== 0) return byCreated;
    const sev = { critical: 0, warning: 1, info: 2 };
    return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3) || b.count - a.count;
  });

  return {
    insights: sorted,
    allResults: results,
    summary: {
      totalRules: rules.length,
      enabledRules: enabledRules.length,
      activeInsights: active.length,
      criticalCount: bySeverity.critical.length,
      warningCount: bySeverity.warning.length,
      infoCount: bySeverity.info.length,
      affectedAssets: new Set(
        active.flatMap((r) => r.items.map((i) => i.id))
      ).size,
    },
    thresholds,
    notifications: config.notifications,
  };
}

export { resolveConditionValue, compareValues };
