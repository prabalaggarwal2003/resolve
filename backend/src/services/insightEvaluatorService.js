import mongoose from 'mongoose';
import { Asset, Issue, AssetLog } from '../models/index.js';
import { getKpiSummary } from './kpiSummaryService.js';
import { getBudgetAnalyticsSummary } from './budgetSummaryService.js';
import { countPendingProcurements } from './budgetRollupService.js';
import { ensureInsightOrgConfig } from './insightOrgConfigService.js';
import { listInsightRules } from './insightOrgConfigService.js';

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
      { $match: { organizationId: orgId, status: { $in: ['open', 'in_progress'] }, severity: 'critical' } },
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
      warrantyDaysUntilExpiry: daysUntil(raw.warrantyExpiry || kpi.warrantyExpiry, now),
      amcDaysUntilExpiry: daysUntil(raw.amcExpiry, now),
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

function evaluateAssetRule(rule, assets, thresholds) {
  const matches = assets.filter((asset) =>
    evaluateConditionTree(rule.conditionTree, (metric) => asset[metric], thresholds)
  );
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
    count: matches.length,
    message: formatMessage(rule.messageTemplate, {
      count: matches.length,
      name: rule.name,
      days: thresholds.warrantyAlertDays,
      threshold: thresholds.repairCountThreshold,
      pct: thresholds.budgetUtilizationWarning,
    }),
    link: rule.link,
    items: matches.slice(0, 10).map((a) => ({
      id: a.assetId,
      label: a.name,
      sublabel: a.assetIdString,
      meta: `Health ${a.healthScore}%`,
    })),
  };
}

function evaluateBudgetRule(rule, budgets, thresholds) {
  const matches = budgets.filter((b) =>
    evaluateConditionTree(
      rule.conditionTree,
      (metric) => (metric === 'utilizationPct' ? b.utilizationPct : b[metric]),
      thresholds
    )
  );
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
    count: matches.length,
    message: formatMessage(rule.messageTemplate, {
      count: matches.length,
      name: rule.name,
      pct: thresholds.budgetUtilizationWarning,
    }),
    link: rule.link,
    items: matches.slice(0, 10).map((b) => ({
      id: b.id,
      label: b.name,
      sublabel: `${b.utilizationPct}% utilized`,
      meta: b.statusLabel,
    })),
  };
}

function evaluateAggregateRule(rule, orgCtx, thresholds) {
  const matches = evaluateConditionTree(
    rule.conditionTree,
    (metric) => orgCtx[metric],
    thresholds
  );
  const count = matches ? orgCtx.pendingProcurementCount || 1 : 0;
  if (!matches) {
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
      count: 0,
      message: formatMessage(rule.messageTemplate, { count: 0, name: rule.name }),
      link: rule.link,
      items: [],
    };
  }
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
    count,
    message: formatMessage(rule.messageTemplate, { count, name: rule.name }),
    link: rule.link,
    items: [],
  };
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

export async function evaluateInsights(organizationId) {
  const [config, rules, assets, budgets, orgCtx] = await Promise.all([
    ensureInsightOrgConfig(organizationId),
    listInsightRules(organizationId),
    buildAssetContext(organizationId),
    buildBudgetContext(organizationId),
    buildOrgContext(organizationId),
  ]);

  const thresholds = { ...config.thresholds };
  const enabledRules = rules.filter((r) => r.enabled);

  const results = enabledRules.map((rule) => {
    if (rule.ruleType === 'budget') return evaluateBudgetRule(rule, budgets, thresholds);
    if (rule.ruleType === 'aggregate' || rule.ruleType === 'org') {
      return evaluateAggregateRule(rule, orgCtx, thresholds);
    }
    return evaluateAssetRule(rule, assets, thresholds);
  });

  const active = results.filter((r) => r.count > 0);
  const bySeverity = {
    critical: active.filter((r) => r.severity === 'critical'),
    warning: active.filter((r) => r.severity === 'warning'),
    info: active.filter((r) => r.severity === 'info'),
  };

  return {
    insights: active.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3) || b.count - a.count;
    }),
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
