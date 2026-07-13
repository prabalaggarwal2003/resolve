import type { HealthAssetRow, HealthTotals, HealthTrendPoint } from './assetHealth';

export const HEALTH_GRID_COLS = 12;
export const HEALTH_MIN_COL_SPAN = 3;
export const HEALTH_MAX_COL_SPAN = 12;
export const HEALTH_MIN_ROW_SPAN = 1;
export const HEALTH_MAX_ROW_SPAN = 6;
export const HEALTH_ROW_HEIGHT_PX = 72;

export function clampHealthSpan(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export type HealthFilterFieldKey =
  | 'departmentId' | 'locationId' | 'groupId' | 'templateId'
  | 'vendorId' | 'status' | 'category' | 'condition' | 'assignedUserId'
  | 'healthLevel' | 'healthScoreMin' | 'healthScoreMax';

export type HealthWidgetFilters = Partial<Record<HealthFilterFieldKey, string>>;

export type HealthMetric =
  | 'avg_health_score'
  | 'health_excellent' | 'health_good' | 'health_fair' | 'health_poor' | 'health_critical'
  | 'health_distribution' | 'health_trend' | 'health_score';

export type HealthGroupBy = 'group' | 'department' | 'location' | 'category' | 'condition' | 'health_level' | null;

export type HealthChartType = 'kpi' | 'bar' | 'horizontal_bar' | 'line' | 'donut' | 'gauge' | 'table';

export type HealthQuickType = 'lowest_health_assets' | 'health_by_condition' | 'critical_health_assets';

export type HealthWidget = {
  id: string;
  title: string;
  kind: 'metric' | 'quick';
  metric?: HealthMetric;
  groupBy?: HealthGroupBy;
  chartType?: HealthChartType;
  quickType?: HealthQuickType;
  filters?: HealthWidgetFilters;
  filterFields?: HealthFilterFieldKey[];
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  order: number;
  colSpan: number;
  rowSpan: number;
  sizeLocked?: boolean;
  hidden?: boolean;
};

export type HealthDashboardLayout = {
  version: number;
  widgets: HealthWidget[];
};

export type HealthDashboard = {
  _id: string;
  name: string;
  description?: string;
  scope: 'personal' | 'organization';
  templateId?: string | null;
  layout: HealthDashboardLayout;
  autoRefresh?: string;
};

export type HealthDataContext = {
  assets: HealthAssetRow[];
  totals: HealthTotals;
  trend: HealthTrendPoint[];
};

export type HealthWidgetResult = {
  kpiValue?: string;
  kpiHint?: string;
  gaugeValue?: number;
  gaugeMax?: number;
  points: Array<{ label: string; value: number; color?: string; hint?: string }>;
  tableRows?: Array<{ label: string; value: string }>;
  listRows?: Array<{ primary: string; secondary?: string; meta?: string }>;
  linePoints?: Array<{ label: string; value: number }>;
};

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4'];

function colorAt(i: number) {
  return COLORS[i % COLORS.length];
}

const LEVEL_COLORS: Record<string, string> = {
  excellent: '#22c55e',
  good: '#3b82f6',
  fair: '#eab308',
  poor: '#f97316',
  critical: '#ef4444',
};

export function applyHealthWidgetFilters(assets: HealthAssetRow[], filters: HealthWidgetFilters = {}) {
  return assets.filter((a) => {
    if (filters.departmentId && a.departmentId !== filters.departmentId) return false;
    if (filters.locationId && a.locationId !== filters.locationId) return false;
    if (filters.groupId && a.groupId !== filters.groupId) return false;
    if (filters.status && a.status !== filters.status) return false;
    if (filters.category && a.category !== filters.category) return false;
    if (filters.condition && a.condition !== filters.condition) return false;
    if (filters.healthLevel && a.healthLevel !== filters.healthLevel) return false;
    if (filters.healthScoreMin != null && filters.healthScoreMin !== '') {
      if (a.healthScore < Number(filters.healthScoreMin)) return false;
    }
    if (filters.healthScoreMax != null && filters.healthScoreMax !== '') {
      if (a.healthScore > Number(filters.healthScoreMax)) return false;
    }
    return true;
  });
}

function formatTrendLabel(date: string) {
  if (!date) return '';
  const parts = date.split('-');
  if (parts.length >= 3) return `${parts[1]}/${parts[2]}`;
  return date.length >= 10 ? date.slice(5) : date;
}

export function buildHealthTrendPoints(ctx: HealthDataContext): Array<{ label: string; value: number }> {
  const raw = ctx.trend || [];
  if (raw.length) {
    return raw.map((t) => ({ label: formatTrendLabel(t.date), value: Number(t.avgScore) || 0 }));
  }
  if (ctx.totals?.totalAssets && ctx.totals.avgHealthScore != null) {
    const today = new Date().toISOString().slice(0, 10);
    return [{ label: formatTrendLabel(today), value: ctx.totals.avgHealthScore }];
  }
  return [];
}

function getGroupKey(a: HealthAssetRow, groupBy: HealthGroupBy): string {
  switch (groupBy) {
    case 'group': return a.groupName || 'Ungrouped';
    case 'department': return a.department || 'Unassigned';
    case 'location': return a.location || 'Unassigned';
    case 'category': return a.category || 'Other';
    case 'condition': return a.condition || 'unknown';
    case 'health_level': return a.healthLabel || a.healthLevel;
    default: return 'All';
  }
}

export function computeHealthWidgetData(ctx: HealthDataContext, widget: HealthWidget): HealthWidgetResult {
  const filtered = applyHealthWidgetFilters(ctx.assets, widget.filters);

  if (widget.kind === 'quick' && widget.quickType) {
    const limit = widget.limit || 10;
    if (widget.quickType === 'lowest_health_assets') {
      const rows = [...filtered]
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, limit)
        .map((a) => ({
          primary: a.name,
          secondary: a.assetIdString,
          meta: `${a.healthEmoji || ''} ${a.healthScore}`,
        }));
      return { listRows: rows, points: [] };
    }
    if (widget.quickType === 'critical_health_assets') {
      const rows = [...filtered]
        .filter((a) => a.healthLevel === 'critical' || a.healthLevel === 'poor')
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, limit)
        .map((a) => ({
          primary: a.name,
          secondary: a.assetIdString,
          meta: `${a.healthEmoji || ''} ${a.healthScore}`,
        }));
      return { listRows: rows, points: [] };
    }
    if (widget.quickType === 'health_by_condition') {
      const counts: Record<string, number> = {};
      filtered.forEach((a) => { counts[a.condition] = (counts[a.condition] || 0) + 1; });
      const points = Object.entries(counts).map(([label, value], i) => ({
        label, value, color: colorAt(i),
      }));
      return { points };
    }
  }

  const metric = widget.metric || 'avg_health_score';
  const chartType = widget.chartType || 'kpi';

  if (metric === 'health_trend') {
    const linePoints = buildHealthTrendPoints(ctx);
    if (chartType === 'kpi') {
      const last = linePoints[linePoints.length - 1];
      return {
        kpiValue: last ? String(last.value) : '—',
        kpiHint: linePoints.length < 2 ? 'Trend builds as daily snapshots are recorded' : undefined,
        linePoints,
        points: [],
      };
    }
    if (chartType === 'table') {
      return {
        linePoints,
        points: [],
        tableRows: linePoints.map((p) => ({ label: p.label, value: String(p.value) })),
      };
    }
    return { linePoints, points: linePoints.map((p, i) => ({ ...p, color: colorAt(i) })) };
  }

  if (chartType === 'kpi' || chartType === 'gauge') {
    let val = 0;
    if (metric === 'avg_health_score' || metric === 'health_score') {
      val = filtered.length
        ? Math.round(filtered.reduce((s, a) => s + a.healthScore, 0) / filtered.length)
        : 0;
    } else if (metric.startsWith('health_')) {
      const key = metric.replace('health_', '');
      val = ctx.totals.distribution[key] ?? filtered.filter((a) => a.healthLevel === key).length;
    }
    if (chartType === 'gauge') {
      return { kpiValue: String(val), gaugeValue: val, gaugeMax: 100, points: [] };
    }
    return { kpiValue: String(val), points: [] };
  }

  if (metric === 'health_distribution') {
    const groupBy = widget.groupBy || 'health_level';
    const counts: Record<string, number> = {};
    filtered.forEach((a) => {
      const k = getGroupKey(a, groupBy);
      counts[k] = (counts[k] || 0) + 1;
    });
    const points = Object.entries(counts).map(([label, value], i) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value,
      color: LEVEL_COLORS[label.toLowerCase()] || colorAt(i),
    }));
    return { points };
  }

  const groupBy = widget.groupBy || 'group';
  const buckets: Record<string, { sum: number; count: number }> = {};
  for (const a of filtered) {
    const key = getGroupKey(a, groupBy);
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
    buckets[key].sum += a.healthScore;
    buckets[key].count += 1;
  }

  let points = Object.entries(buckets).map(([label, b], i) => ({
    label,
    value: b.count ? Math.round((b.sum / b.count) * 10) / 10 : 0,
    color: colorAt(i),
    hint: `${b.count} assets`,
  }));

  const sortDesc = widget.sortOrder !== 'asc';
  points = points.sort((a, b) => (sortDesc ? b.value - a.value : a.value - b.value));
  points = points.slice(0, widget.limit || 12);

  if (chartType === 'table') {
    return {
      points,
      tableRows: points.map((p) => ({ label: p.label, value: String(p.value) })),
    };
  }

  return { points };
}

export function getDefaultHealthDashboardLayout(): HealthDashboardLayout {
  return {
    version: 1,
    widgets: [
      { id: 'h1', kind: 'metric', title: 'Average Health Score', metric: 'avg_health_score', chartType: 'gauge', filters: {}, filterFields: [], order: 0, colSpan: 4, rowSpan: 2, sizeLocked: false },
      { id: 'h2', kind: 'metric', title: 'Health Distribution', metric: 'health_distribution', groupBy: 'health_level', chartType: 'donut', filters: {}, filterFields: [], order: 1, colSpan: 4, rowSpan: 2, sizeLocked: false },
      { id: 'h3', kind: 'metric', title: 'Health Trend', metric: 'health_trend', chartType: 'line', filters: {}, filterFields: [], order: 2, colSpan: 4, rowSpan: 2, sizeLocked: false },
      { id: 'h4', kind: 'metric', title: 'Health by Group', metric: 'avg_health_score', groupBy: 'group', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 3, colSpan: 6, rowSpan: 3, sizeLocked: false },
      { id: 'h5', kind: 'quick', title: 'Lowest Health Assets', quickType: 'lowest_health_assets', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3, sizeLocked: false, limit: 10 },
    ],
  };
}

export function mergeHealthLayout(layout?: HealthDashboardLayout | null): HealthDashboardLayout {
  if (!layout?.widgets?.length) return getDefaultHealthDashboardLayout();
  return {
    version: layout.version || 1,
    widgets: layout.widgets.map((w, i) => ({
      ...w,
      filters: w.filters ?? {},
      filterFields: w.filterFields ?? [],
      colSpan: w.colSpan ?? 6,
      rowSpan: w.rowSpan ?? 2,
      order: w.order ?? i,
    })),
  };
}

export function newHealthWidget(partial?: Partial<HealthWidget>): HealthWidget {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hw-${Date.now()}`;
  return {
    id,
    title: 'New widget',
    kind: 'metric',
    metric: 'avg_health_score',
    chartType: 'kpi',
    filters: {},
    filterFields: [],
    order: 0,
    colSpan: 6,
    rowSpan: 2,
    sizeLocked: false,
    ...partial,
  };
}

export function reorderHealthWidgets(widgets: HealthWidget[], dragId: string, targetId: string): HealthWidget[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const from = sorted.findIndex((w) => w.id === dragId);
  const to = sorted.findIndex((w) => w.id === targetId);
  if (from < 0 || to < 0) return sorted;
  const [item] = sorted.splice(from, 1);
  sorted.splice(to, 0, item);
  return sorted.map((w, i) => ({ ...w, order: i }));
}

export function suggestHealthWidgetSize(widget: HealthWidget, result: HealthWidgetResult) {
  if (widget.sizeLocked && widget.colSpan && widget.rowSpan) {
    return { colSpan: widget.colSpan, rowSpan: widget.rowSpan };
  }
  if (widget.kind === 'quick') return { colSpan: 6, rowSpan: 3 };
  if (widget.chartType === 'kpi' || widget.chartType === 'gauge') {
    return { colSpan: 3, rowSpan: 1 + ((widget.filterFields?.length ?? 0) > 0 ? 1 : 0) };
  }
  const n = result.points.length || result.linePoints?.length || result.listRows?.length || 0;
  return { colSpan: 6, rowSpan: clampHealthSpan(2 + Math.ceil(n / 4), HEALTH_MIN_ROW_SPAN, HEALTH_MAX_ROW_SPAN) };
}

export const HEALTH_METRIC_OPTIONS: Array<{ id: HealthMetric; label: string; category: string }> = [
  { id: 'avg_health_score', label: 'Average Health Score', category: 'Overview' },
  { id: 'health_distribution', label: 'Health Distribution', category: 'Overview' },
  { id: 'health_trend', label: 'Health Trend', category: 'Overview' },
  { id: 'health_excellent', label: 'Excellent Count', category: 'Levels' },
  { id: 'health_good', label: 'Good Count', category: 'Levels' },
  { id: 'health_fair', label: 'Fair Count', category: 'Levels' },
  { id: 'health_poor', label: 'Poor Count', category: 'Levels' },
  { id: 'health_critical', label: 'Critical Count', category: 'Levels' },
  { id: 'health_score', label: 'Health Score (grouped)', category: 'Breakdown' },
];

export const HEALTH_GROUP_BY_OPTIONS: { id: NonNullable<HealthGroupBy>; label: string }[] = [
  { id: 'group', label: 'Asset Group' },
  { id: 'department', label: 'Department' },
  { id: 'location', label: 'Location' },
  { id: 'category', label: 'Category' },
  { id: 'condition', label: 'Condition' },
  { id: 'health_level', label: 'Health Level' },
];

export const HEALTH_CHART_TYPE_OPTIONS: { id: HealthChartType; label: string; needsGroupBy?: boolean }[] = [
  { id: 'kpi', label: 'KPI Card', needsGroupBy: false },
  { id: 'gauge', label: 'Gauge', needsGroupBy: false },
  { id: 'bar', label: 'Bar Chart', needsGroupBy: true },
  { id: 'horizontal_bar', label: 'Horizontal Bar', needsGroupBy: true },
  { id: 'line', label: 'Line Chart', needsGroupBy: false },
  { id: 'donut', label: 'Donut Chart', needsGroupBy: true },
  { id: 'table', label: 'Table', needsGroupBy: true },
];

export const HEALTH_QUICK_OPTIONS: { id: HealthQuickType; label: string }[] = [
  { id: 'lowest_health_assets', label: 'Lowest Health Assets' },
  { id: 'critical_health_assets', label: 'Critical & Poor Assets' },
  { id: 'health_by_condition', label: 'Assets by Condition' },
];

export const HEALTH_WIDGET_FILTER_CATALOG: { key: HealthFilterFieldKey; label: string; category: string }[] = [
  { key: 'healthLevel', label: 'Health level', category: 'Health metrics' },
  { key: 'healthScoreMin', label: 'Min health score', category: 'Health metrics' },
  { key: 'healthScoreMax', label: 'Max health score', category: 'Health metrics' },
  { key: 'departmentId', label: 'Department', category: 'Asset attributes' },
  { key: 'locationId', label: 'Location', category: 'Asset attributes' },
  { key: 'groupId', label: 'Asset group', category: 'Asset attributes' },
  { key: 'status', label: 'Status', category: 'Asset attributes' },
  { key: 'category', label: 'Category', category: 'Asset attributes' },
  { key: 'condition', label: 'Condition', category: 'Asset attributes' },
];

export const HEALTH_LEVEL_FILTER_OPTIONS = [
  { key: 'excellent', label: 'Excellent' },
  { key: 'good', label: 'Good' },
  { key: 'fair', label: 'Fair' },
  { key: 'poor', label: 'Poor' },
  { key: 'critical', label: 'Critical' },
];

export const HEALTH_WIDGET_LIBRARY: { category: string; items: { title: string; widget: Partial<HealthWidget> }[] }[] = [
  {
    category: 'Overview',
    items: [
      { title: 'Average Health Score', widget: { kind: 'metric', metric: 'avg_health_score', chartType: 'gauge' } },
      { title: 'Health Distribution', widget: { kind: 'metric', metric: 'health_distribution', groupBy: 'health_level', chartType: 'donut' } },
      { title: 'Health Trend', widget: { kind: 'metric', metric: 'health_trend', chartType: 'line' } },
    ],
  },
  {
    category: 'Health Levels',
    items: [
      { title: 'Excellent Assets', widget: { kind: 'metric', metric: 'health_excellent', chartType: 'kpi' } },
      { title: 'Good Assets', widget: { kind: 'metric', metric: 'health_good', chartType: 'kpi' } },
      { title: 'Fair Assets', widget: { kind: 'metric', metric: 'health_fair', chartType: 'kpi' } },
      { title: 'Poor Assets', widget: { kind: 'metric', metric: 'health_poor', chartType: 'kpi' } },
      { title: 'Critical Assets', widget: { kind: 'metric', metric: 'health_critical', chartType: 'kpi' } },
    ],
  },
  {
    category: 'Breakdown',
    items: [
      { title: 'Health by Group', widget: { kind: 'metric', metric: 'avg_health_score', groupBy: 'group', chartType: 'horizontal_bar' } },
      { title: 'Health by Department', widget: { kind: 'metric', metric: 'avg_health_score', groupBy: 'department', chartType: 'horizontal_bar' } },
      { title: 'Health by Location', widget: { kind: 'metric', metric: 'avg_health_score', groupBy: 'location', chartType: 'bar' } },
      { title: 'Health by Condition', widget: { kind: 'metric', metric: 'health_distribution', groupBy: 'condition', chartType: 'donut' } },
    ],
  },
  {
    category: 'Lists',
    items: [
      { title: 'Lowest Health Assets', widget: { kind: 'quick', quickType: 'lowest_health_assets', limit: 10 } },
      { title: 'Critical & Poor Assets', widget: { kind: 'quick', quickType: 'critical_health_assets', limit: 10 } },
    ],
  },
];

export function chartTypesForHealthMetric(metric?: HealthMetric, kind?: HealthWidget['kind']): HealthChartType[] {
  if (kind === 'quick') return [];
  switch (metric) {
    case 'health_trend':
      return ['kpi', 'line', 'table'];
    case 'health_distribution':
      return ['donut', 'bar', 'horizontal_bar', 'table'];
    case 'health_excellent':
    case 'health_good':
    case 'health_fair':
    case 'health_poor':
    case 'health_critical':
      return ['kpi'];
    case 'avg_health_score':
    case 'health_score':
    default:
      return ['kpi', 'gauge', 'bar', 'horizontal_bar', 'donut', 'table'];
  }
}
