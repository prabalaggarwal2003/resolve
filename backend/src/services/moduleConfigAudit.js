import { formatChangesSummary } from './assetLogService.js';
import { DEFAULT_BUDGET_SETTINGS } from '../constants/budgetDefaults.js';
import { HEALTH_FACTOR_META } from '../constants/assetHealthDefaults.js';

const INSIGHT_THRESHOLD_LABELS = {
  budgetUtilizationWarning: 'Budget warning %',
  budgetUtilizationCritical: 'Budget critical %',
  warrantyAlertDays: 'Warranty alert (days)',
  warrantyAlertDaysSecondary: 'Warranty alert — secondary (days)',
  warrantyAlertDaysTertiary: 'Warranty alert — early (days)',
  healthScoreWarning: 'Health score warning',
  healthScoreCritical: 'Health score critical',
  replacementScoreHigh: 'Replacement score high',
  replacementScoreCritical: 'Replacement score critical',
  repairCountThreshold: 'Repair count threshold',
  ageYearsThreshold: 'Asset age threshold (years)',
  maintenanceCostThreshold: 'Maintenance cost threshold',
  openCriticalIssuesThreshold: 'Open critical issues',
  auditDueDays: 'Audit due period (days)',
  scanStaleDays: 'Scan stale period (days)',
  maintenanceDueSoonDays: 'Maintenance due soon (days)',
  highIssueCountThreshold: 'High issue count',
  lowUtilizationPct: 'Low utilization %',
};

const BUDGET_CONFIG_SECTION_LABELS = {
  budgetTypes: 'Budget types',
  budgetStatuses: 'Budget statuses',
  fundingSources: 'Funding sources',
  enabledDimensions: 'Budget dimensions',
  customFields: 'Budget custom fields',
  settings: 'Budget settings',
};

const PROCUREMENT_CONFIG_SECTION_LABELS = {
  procurementLifecycleStages: 'Procurement lifecycle stages',
  procurementPaymentStatuses: 'Procurement payment statuses',
  procurementCustomFields: 'Procurement custom fields',
};

const BUDGET_SETTINGS_LABELS = {
  autoUpdateOnAssetCreate: 'Auto-update on asset create',
  autoUpdateOnPurchaseApprove: 'Auto-update on purchase approve',
  warnThresholdPct: 'Warning threshold %',
  criticalThresholdPct: 'Critical threshold %',
};

const INSIGHT_NOTIFICATION_LABELS = {
  showOnDashboard: 'Show on insights dashboard',
  showInApp: 'In-app notifications',
  maxDashboardItems: 'Max dashboard items',
};

const INSIGHT_RULE_LABELS = {
  name: 'Name',
  description: 'Description',
  category: 'Category',
  severity: 'Severity',
  enabled: 'Enabled',
  messageTemplate: 'Message template',
  link: 'View link',
  order: 'Sort order',
  conditionTree: 'Rule conditions',
};

const ASSET_HEALTH_SCALAR_LABELS = {
  autoUpdateCondition: 'Auto-update asset condition',
  defaultNewAssetCondition: 'Default new asset condition',
};

const PROFILE_SCALAR_LABELS = {
  name: 'Name',
  description: 'Description',
  groupId: 'Asset group',
  enabled: 'Enabled',
  order: 'Sort order',
};

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function formatBool(value) {
  if (value == null) return '—';
  return value ? 'Yes' : 'No';
}

function formatPrimitive(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return formatBool(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function summarizeList(items) {
  if (!Array.isArray(items) || !items.length) return '—';
  if (items[0]?.name) return items.map((i) => i.name).join(', ');
  return `${items.length} item(s)`;
}

function summarizeJson(value, maxLen = 140) {
  if (value == null) return '—';
  if (Array.isArray(value)) return summarizeList(value);
  if (typeof value === 'object') {
    const text = JSON.stringify(value);
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
  }
  return formatPrimitive(value);
}

function pushScalarChange(changes, field, label, before, after) {
  const oldValue = formatPrimitive(before);
  const newValue = formatPrimitive(after);
  if (oldValue === newValue) return;
  changes.push({ field, label, oldValue, newValue });
}

function diffObjectScalars(prev = {}, next = {}, labels = {}) {
  const changes = [];
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  for (const key of keys) {
    const label = labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    pushScalarChange(changes, key, label, prev?.[key], next?.[key]);
  }
  return changes;
}

function diffJsonSection(changes, field, label, before, after) {
  if (stableJson(before) === stableJson(after)) return;
  changes.push({
    field,
    label,
    oldValue: summarizeJson(before),
    newValue: summarizeJson(after),
  });
}

function diffAssetHealthFactors(prev = {}, next = {}) {
  const changes = [];
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    const before = prev[key];
    const after = next[key];
    const baseLabel = before?.label || after?.label || HEALTH_FACTOR_META[key]?.label || key;

    if (!before && after) {
      changes.push({
        field: `factors.${key}`,
        label: `${baseLabel} factor`,
        oldValue: '—',
        newValue: `Added (weight ${after.weight ?? 0}%)`,
      });
      continue;
    }
    if (before && !after) {
      changes.push({
        field: `factors.${key}`,
        label: `${baseLabel} factor`,
        oldValue: `Removed (weight ${before.weight ?? 0}%)`,
        newValue: '—',
      });
      continue;
    }

    pushScalarChange(changes, `factors.${key}.enabled`, `${baseLabel} enabled`, before.enabled, after.enabled);
    pushScalarChange(changes, `factors.${key}.weight`, `${baseLabel} weight`, before.weight, after.weight);
    if (before.label !== after.label) {
      pushScalarChange(changes, `factors.${key}.label`, `${baseLabel} label`, before.label, after.label);
    }
    if (before.source !== after.source) {
      pushScalarChange(changes, `factors.${key}.source`, `${baseLabel} source`, before.source, after.source);
    }
  }
  return changes;
}

function diffThresholdMaps(prev = {}, next = {}) {
  const changes = [];
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    if (stableJson(prev[key]) === stableJson(next[key])) continue;
    const label = HEALTH_FACTOR_META[key]?.label || key.replace(/_/g, ' ');
    changes.push({
      field: `thresholds.${key}`,
      label: `${label} thresholds`,
      oldValue: summarizeJson(prev[key]),
      newValue: summarizeJson(next[key]),
    });
  }
  return changes;
}

export function buildAuditChangePayload(fieldChanges) {
  if (!fieldChanges?.length) return null;
  return {
    fieldChanges,
    summary: formatChangesSummary(fieldChanges),
  };
}

export function buildBudgetOrgConfigChanges(before, after) {
  const budgetChanges = [];
  const procurementChanges = [];

  for (const [key, label] of Object.entries(BUDGET_CONFIG_SECTION_LABELS)) {
    if (key === 'settings') {
      budgetChanges.push(
        ...diffObjectScalars(
          before?.settings || DEFAULT_BUDGET_SETTINGS,
          after?.settings || DEFAULT_BUDGET_SETTINGS,
          BUDGET_SETTINGS_LABELS
        )
      );
    } else {
      diffJsonSection(budgetChanges, key, label, before?.[key], after?.[key]);
    }
  }

  for (const [key, label] of Object.entries(PROCUREMENT_CONFIG_SECTION_LABELS)) {
    diffJsonSection(procurementChanges, key, label, before?.[key], after?.[key]);
  }

  return {
    budgetChanges,
    procurementChanges,
    budgetPayload: buildAuditChangePayload(budgetChanges),
    procurementPayload: buildAuditChangePayload(procurementChanges),
  };
}

export function buildInsightOrgConfigChanges(before, after) {
  const changes = [
    ...diffObjectScalars(before?.thresholds, after?.thresholds, INSIGHT_THRESHOLD_LABELS),
    ...diffObjectScalars(before?.notifications, after?.notifications, INSIGHT_NOTIFICATION_LABELS),
  ];
  return buildAuditChangePayload(changes);
}

export function buildInsightRuleChanges(before, after) {
  const changes = [];
  for (const [key, label] of Object.entries(INSIGHT_RULE_LABELS)) {
    if (key === 'conditionTree') {
      if (stableJson(before?.conditionTree) !== stableJson(after?.conditionTree)) {
        changes.push({
          field: key,
          label,
          oldValue: summarizeJson(before?.conditionTree, 100),
          newValue: summarizeJson(after?.conditionTree, 100),
        });
      }
      continue;
    }
    pushScalarChange(changes, key, label, before?.[key], after?.[key]);
  }
  return buildAuditChangePayload(changes);
}

export function buildAssetHealthOrgConfigChanges(before, after) {
  const changes = [];

  for (const [key, label] of Object.entries(ASSET_HEALTH_SCALAR_LABELS)) {
    pushScalarChange(changes, key, label, before?.[key], after?.[key]);
  }

  if (stableJson(before?.factors) !== stableJson(after?.factors)) {
    changes.push(...diffAssetHealthFactors(before?.factors, after?.factors));
  }

  if (stableJson(before?.thresholds) !== stableJson(after?.thresholds)) {
    changes.push(...diffThresholdMaps(before?.thresholds, after?.thresholds));
  }

  diffJsonSection(changes, 'healthLevels', 'Health levels', before?.healthLevels, after?.healthLevels);
  diffJsonSection(changes, 'automationRules', 'Automation rules', before?.automationRules, after?.automationRules);

  return buildAuditChangePayload(changes);
}

export function buildAssetHealthProfileChanges(before, after) {
  const changes = [];

  for (const [key, label] of Object.entries(PROFILE_SCALAR_LABELS)) {
    pushScalarChange(changes, key, label, before?.[key], after?.[key]);
  }

  diffJsonSection(changes, 'factors', 'Profile factor overrides', before?.factors, after?.factors);
  diffJsonSection(changes, 'thresholds', 'Profile thresholds', before?.thresholds, after?.thresholds);

  return buildAuditChangePayload(changes);
}

export function buildAssetHealthRuleResetChanges(ruleKey, beforeRule, afterRule) {
  if (!beforeRule || !afterRule) return null;
  if (stableJson(beforeRule) === stableJson(afterRule)) return null;
  return buildAuditChangePayload([
    {
      field: `automationRules.${ruleKey}`,
      label: `Automation rule "${ruleKey}"`,
      oldValue: summarizeJson(beforeRule, 100),
      newValue: summarizeJson(afterRule, 100),
    },
  ]);
}
