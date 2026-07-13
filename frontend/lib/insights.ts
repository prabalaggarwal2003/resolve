export function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export type InsightSeverity = 'info' | 'warning' | 'critical';

export type InsightCondition = {
  metric: string;
  operator: string;
  value?: string | number | boolean | string[];
  thresholdKey?: string;
};

export type InsightConditionGroup = {
  logic: 'and' | 'or';
  conditions: InsightCondition[];
};

export type InsightConditionTree = {
  rootLogic: 'and' | 'or';
  groups: InsightConditionGroup[];
};

export type InsightRule = {
  _id: string;
  ruleKey: string;
  isBuiltin: boolean;
  name: string;
  description: string;
  category: string;
  ruleType: 'asset' | 'budget' | 'aggregate' | 'org';
  severity: InsightSeverity;
  enabled: boolean;
  messageTemplate: string;
  conditionTree: InsightConditionTree;
  link: string;
  order: number;
};

export type InsightThresholds = Record<string, number>;

export type InsightOrgConfig = {
  thresholds: InsightThresholds;
  notifications: {
    showOnDashboard: boolean;
    showInApp: boolean;
    maxDashboardItems: number;
  };
};

export type InsightResult = {
  ruleId: string;
  ruleKey: string;
  name: string;
  description: string;
  category: string;
  severity: InsightSeverity;
  ruleType: string;
  enabled: boolean;
  isBuiltin: boolean;
  count: number;
  message: string;
  link: string;
  items: { id: string; label: string; sublabel?: string; meta?: string }[];
};

export type InsightDashboardData = {
  insights: InsightResult[];
  allResults: InsightResult[];
  summary: {
    totalRules: number;
    enabledRules: number;
    activeInsights: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    affectedAssets: number;
  };
  thresholds: InsightThresholds;
  notifications: InsightOrgConfig['notifications'];
};

export type InsightMetricDef = {
  key: string;
  label: string;
  type: string;
  scope: string;
  options?: string[];
  ref?: string;
};

export type InsightCatalog = {
  metrics: InsightMetricDef[];
  operators: string[];
  severities: string[];
  categories: string[];
  defaultThresholds: InsightThresholds;
};

export async function fetchInsightCatalog(): Promise<InsightCatalog> {
  const res = await fetch(api('/api/insights/catalog'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load catalog');
  return data;
}

export async function fetchInsightConfig(): Promise<InsightOrgConfig> {
  const res = await fetch(api('/api/insights/config'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load config');
  return data.config;
}

export async function updateInsightConfig(payload: Partial<InsightOrgConfig>): Promise<InsightOrgConfig> {
  const res = await fetch(api('/api/insights/config'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to save config');
  return data.config;
}

export async function fetchInsightRules(): Promise<InsightRule[]> {
  const res = await fetch(api('/api/insights/rules'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load rules');
  return data.rules || [];
}

export async function createInsightRule(payload: Partial<InsightRule>): Promise<InsightRule> {
  const res = await fetch(api('/api/insights/rules'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create rule');
  return data.rule;
}

export async function updateInsightRule(id: string, payload: Partial<InsightRule>): Promise<InsightRule> {
  const res = await fetch(api(`/api/insights/rules/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update rule');
  return data.rule;
}

export async function resetInsightRule(id: string): Promise<InsightRule> {
  const res = await fetch(api(`/api/insights/rules/${id}/reset`), {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to reset rule');
  return data.rule;
}

export async function deleteInsightRule(id: string): Promise<void> {
  const res = await fetch(api(`/api/insights/rules/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete rule');
}

export async function fetchInsightDashboard(): Promise<InsightDashboardData> {
  const res = await fetch(api('/api/insights/dashboard'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load insights');
  return data;
}

export const OPERATOR_LABELS: Record<string, string> = {
  eq: 'equals',
  ne: 'not equals',
  gt: 'greater than',
  gte: 'greater or equal',
  lt: 'less than',
  lte: 'less or equal',
  contains: 'contains',
  in: 'is one of',
  empty: 'is empty',
  not_empty: 'is not empty',
};

/** Plain-language operators for the rule builder UI */
export const FRIENDLY_OPERATOR_LABELS: Record<string, string> = {
  eq: 'is exactly',
  ne: 'is not',
  gt: 'is more than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  contains: 'contains',
  in: 'is one of',
  empty: 'is blank',
  not_empty: 'has a value',
};

export const SEVERITY_FRIENDLY: Record<InsightSeverity, string> = {
  info: 'Informational',
  warning: 'Needs attention',
  critical: 'Urgent',
};

export function metricLabel(catalog: InsightCatalog | null | undefined, key: string): string {
  return catalog?.metrics.find((m) => m.key === key)?.label || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

export function describeConditionPlain(
  cond: InsightCondition,
  catalog?: InsightCatalog | null,
  departmentName?: string
): string {
  const metric = metricLabel(catalog, cond.metric);
  const op = FRIENDLY_OPERATOR_LABELS[cond.operator] || OPERATOR_LABELS[cond.operator] || cond.operator;
  if (cond.operator === 'empty' || cond.operator === 'not_empty') {
    return `${metric} ${op}`;
  }
  let val: string;
  if (cond.thresholdKey) {
    const th = THRESHOLD_FIELDS.find((t) => t.key === cond.thresholdKey);
    val = th?.label?.toLowerCase() || 'your organization threshold';
  } else if (cond.metric === 'departmentId' && departmentName) {
    val = departmentName;
  } else if (cond.metric === 'assetCost' || cond.metric === 'maintenanceCost') {
    val = `₹${Number(cond.value || 0).toLocaleString('en-IN')}`;
  } else {
    val = String(cond.value ?? '');
  }
  return `${metric} ${op} ${val}`;
}

export function describeRulePlain(
  rule: Partial<InsightRule>,
  catalog?: InsightCatalog | null,
  departmentNames?: Record<string, string>
): string {
  const tree = rule.conditionTree;
  if (!tree?.groups?.length) return 'No conditions set yet.';

  const groupTexts = tree.groups.map((group) => {
    const joiner = group.logic === 'or' ? ' or ' : ' and ';
    const parts = (group.conditions || []).map((c) =>
      describeConditionPlain(c, catalog, departmentNames?.[String(c.value)])
    );
    return parts.length > 1 ? parts.join(joiner) : parts[0] || '';
  }).filter(Boolean);

  if (!groupTexts.length) return 'No conditions set yet.';
  const rootJoiner = tree.rootLogic === 'or' ? ' — or — ' : ' — and also — ';
  return `Show this insight when ${groupTexts.join(rootJoiner)}`;
}

export const SEVERITY_STYLES: Record<InsightSeverity, { border: string; bg: string; text: string; dot: string }> = {
  critical: { border: 'border-red-500/40', bg: 'bg-red-500/10', text: 'text-red-300', dot: 'bg-red-500' },
  warning: { border: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-300', dot: 'bg-amber-500' },
  info: { border: 'border-blue-500/40', bg: 'bg-blue-500/10', text: 'text-blue-300', dot: 'bg-blue-500' },
};

export const THRESHOLD_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: 'budgetUtilizationWarning', label: 'Budget warning %', hint: 'Alert when utilization reaches this %' },
  { key: 'budgetUtilizationCritical', label: 'Budget critical %' },
  { key: 'warrantyAlertDays', label: 'Warranty alert (days)' },
  { key: 'warrantyAlertDaysSecondary', label: 'Warranty alert — secondary (days)' },
  { key: 'warrantyAlertDaysTertiary', label: 'Warranty alert — early (days)' },
  { key: 'healthScoreWarning', label: 'Health score warning' },
  { key: 'healthScoreCritical', label: 'Health score critical' },
  { key: 'replacementScoreHigh', label: 'Replacement score high' },
  { key: 'repairCountThreshold', label: 'Repair count threshold' },
  { key: 'ageYearsThreshold', label: 'Asset age threshold (years)' },
  { key: 'maintenanceCostThreshold', label: 'Maintenance cost threshold (₹)' },
  { key: 'openCriticalIssuesThreshold', label: 'Open critical issues' },
  { key: 'auditDueDays', label: 'Audit due period (days)' },
  { key: 'scanStaleDays', label: 'Scan stale period (days)' },
  { key: 'maintenanceDueSoonDays', label: 'Maintenance due soon (days)' },
  { key: 'highIssueCountThreshold', label: 'High issue count' },
  { key: 'lowUtilizationPct', label: 'Low utilization %' },
];
