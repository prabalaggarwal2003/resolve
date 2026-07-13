/** Default weighted health scoring configuration */

export const HEALTH_FACTOR_KEYS = [
  'age',
  'condition',
  'issues',
  'maintenance',
  'warranty',
  'audit',
  'downtime',
];

export const HEALTH_FACTOR_META = {
  age: { label: 'Age', defaultWeight: 20 },
  condition: { label: 'Condition', defaultWeight: 25 },
  issues: { label: 'Open Issues', defaultWeight: 15 },
  maintenance: { label: 'Maintenance History', defaultWeight: 15 },
  warranty: { label: 'Warranty', defaultWeight: 10 },
  audit: { label: 'Audit Status', defaultWeight: 10 },
  downtime: { label: 'Downtime', defaultWeight: 5 },
};

export function getDefaultFactorWeights() {
  return Object.fromEntries(
    HEALTH_FACTOR_KEYS.map((key) => [
      key,
      { enabled: true, weight: HEALTH_FACTOR_META[key].defaultWeight },
    ])
  );
}

/**
 * Numeric asset metrics a custom (user-defined) factor can be scored from.
 * Custom factors map one of these metric values through user-configured
 * score bands, so any organization can extend the health model.
 */
export const CUSTOM_FACTOR_SOURCES = [
  { key: 'ageYears', label: 'Asset age (years)', unit: 'years' },
  { key: 'openIssueCount', label: 'Open issues', unit: 'issues' },
  { key: 'issueCount', label: 'Total issues', unit: 'issues' },
  { key: 'maintenanceCount', label: 'Maintenance events', unit: 'events' },
  { key: 'daysSinceLastAudit', label: 'Days since last audit', unit: 'days' },
];

export const CUSTOM_FACTOR_SOURCE_KEYS = CUSTOM_FACTOR_SOURCES.map((s) => s.key);

export const DEFAULT_CUSTOM_FACTOR_BANDS = [
  { min: 0, max: 2, score: 100 },
  { min: 2, max: 5, score: 70 },
  { min: 5, max: null, score: 40 },
];

export const DEFAULT_FACTOR_THRESHOLDS = {
  age: [
    { min: 0, max: 2, score: 100 },
    { min: 2, max: 5, score: 80 },
    { min: 5, max: 8, score: 60 },
    { min: 8, max: 10, score: 40 },
    { min: 10, max: null, score: 20 },
  ],
  condition: {
    excellent: 100,
    good: 85,
    fair: 60,
    poor: 30,
    critical: 0,
    under_maintenance: 40,
  },
  issues: [
    { min: 0, max: 0, score: 100 },
    { min: 1, max: 2, score: 90 },
    { min: 3, max: 5, score: 70 },
    { min: 6, max: 10, score: 40 },
    { min: 11, max: null, score: 10 },
  ],
  maintenance: [
    { min: 0, max: 0, score: 100 },
    { min: 1, max: 2, score: 90 },
    { min: 3, max: 5, score: 70 },
    { min: 6, max: 10, score: 40 },
    { min: 11, max: null, score: 20 },
  ],
  warranty: {
    active: 100,
    expiresIn30Days: 80,
    expired: 50,
    expiredOver1Year: 20,
    none: 70,
  },
  audit: [
    { min: 0, max: 30, score: 100 },
    { min: 31, max: 90, score: 80 },
    { min: 91, max: 180, score: 60 },
    { min: 181, max: 365, score: 40 },
    { min: 366, max: null, score: 20 },
  ],
  downtime: {
    available: 100,
    in_use: 100,
    working: 100,
    under_maintenance: 60,
    needs_repair: 50,
    out_of_service: 30,
    retired: 20,
  },
};

export const DEFAULT_HEALTH_LEVELS = [
  { min: 90, max: 100, label: 'Excellent', key: 'excellent', emoji: '🟢' },
  { min: 75, max: 89, label: 'Good', key: 'good', emoji: '🟢' },
  { min: 50, max: 74, label: 'Fair', key: 'fair', emoji: '🟡' },
  { min: 30, max: 49, label: 'Poor', key: 'poor', emoji: '🟠' },
  { min: 0, max: 29, label: 'Critical', key: 'critical', emoji: '🔴' },
];

export function getDefaultAutomationRules() {
  return [
    {
      ruleKey: 'sync_condition_from_score',
      name: 'Sync condition from health score',
      description: 'Automatically update asset condition based on calculated health score bands',
      enabled: true,
      isBuiltin: true,
      order: 0,
      action: { type: 'sync_condition_from_score' },
    },
    {
      ruleKey: 'maintenance_many_issues',
      name: 'Maintenance when many open issues',
      description: 'Place asset under maintenance when open issues exceed threshold',
      enabled: true,
      isBuiltin: true,
      order: 1,
      conditions: [{ metric: 'openIssuesCount', operator: 'gte', value: 8 }],
      action: { type: 'set_condition', condition: 'under_maintenance', status: 'under_maintenance', maintenanceReason: 'Automatic maintenance due to multiple open issues' },
    },
    {
      ruleKey: 'maintenance_old_asset',
      name: 'Maintenance when asset is very old',
      description: 'Place asset under maintenance when age exceeds threshold',
      enabled: false,
      isBuiltin: true,
      order: 2,
      conditions: [{ metric: 'ageYears', operator: 'gte', value: 10 }],
      action: { type: 'set_condition', condition: 'under_maintenance', status: 'under_maintenance', maintenanceReason: 'Automatic maintenance due to asset age' },
    },
    {
      ruleKey: 'critical_low_score',
      name: 'Flag critical when health score is very low',
      description: 'Set condition to critical when health score drops below threshold',
      enabled: false,
      isBuiltin: true,
      order: 3,
      conditions: [{ metric: 'healthScore', operator: 'lt', value: 30 }],
      action: { type: 'set_condition', condition: 'critical' },
    },
  ];
}

export const DEFAULT_ASSET_HEALTH_CONFIG = {
  factors: getDefaultFactorWeights(),
  thresholds: JSON.parse(JSON.stringify(DEFAULT_FACTOR_THRESHOLDS)),
  healthLevels: [...DEFAULT_HEALTH_LEVELS],
  automationRules: getDefaultAutomationRules(),
  autoUpdateCondition: true,
  defaultNewAssetCondition: 'excellent',
};

export const DEFAULT_HEALTH_DASHBOARD_LAYOUT = {
  version: 1,
  widgets: [
    { id: 'h1', kind: 'metric', title: 'Average Health Score', metric: 'avg_health_score', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 3, rowSpan: 1, sizeLocked: false },
    { id: 'h2', kind: 'metric', title: 'Excellent', metric: 'health_excellent', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 2, rowSpan: 1, sizeLocked: false },
    { id: 'h3', kind: 'metric', title: 'Good', metric: 'health_good', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 2, colSpan: 2, rowSpan: 1, sizeLocked: false },
    { id: 'h4', kind: 'metric', title: 'Fair', metric: 'health_fair', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 3, colSpan: 2, rowSpan: 1, sizeLocked: false },
    { id: 'h5', kind: 'metric', title: 'Poor', metric: 'health_poor', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 4, colSpan: 2, rowSpan: 1, sizeLocked: false },
    { id: 'h6', kind: 'metric', title: 'Critical', metric: 'health_critical', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 5, colSpan: 1, rowSpan: 1, sizeLocked: false },
    { id: 'h7', kind: 'metric', title: 'Health Distribution', metric: 'health_distribution', groupBy: 'health_level', chartType: 'donut', filters: {}, filterFields: [], order: 6, colSpan: 6, rowSpan: 3, sizeLocked: false },
    { id: 'h8', kind: 'metric', title: 'Health by Group', metric: 'avg_health_score', groupBy: 'group', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 7, colSpan: 6, rowSpan: 3, sizeLocked: false },
    { id: 'h9', kind: 'metric', title: 'Health Trend', metric: 'health_trend', groupBy: null, chartType: 'line', filters: {}, filterFields: [], order: 8, colSpan: 6, rowSpan: 3, sizeLocked: false },
    { id: 'h10', kind: 'quick', title: 'Lowest Health Assets', quickType: 'lowest_health_assets', filters: {}, filterFields: [], order: 9, colSpan: 6, rowSpan: 3, sizeLocked: false },
  ],
};

export function getDefaultHealthDashboardLayout() {
  return JSON.parse(JSON.stringify(DEFAULT_HEALTH_DASHBOARD_LAYOUT));
}
