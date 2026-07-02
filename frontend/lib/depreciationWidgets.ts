import type { AssetDepreciationMetrics, DepreciationFilters } from '@/lib/depreciation';
import { DEFAULT_ASSET_STATUSES } from '@/lib/assetStatuses';

export type WidgetMetric =
  | 'purchase_value'
  | 'book_value'
  | 'depreciation'
  | 'depreciation_pct'
  | 'fully_depreciated_count'
  | 'asset_count'
  | 'replacement_score'
  | 'health_score'
  | 'warranty_status'
  | 'issue_count'
  | 'maintenance_cost'
  | 'remaining_life'
  | 'vendor'
  | 'department'
  | 'location'
  | 'group'
  | 'template';

export type WidgetGroupBy =
  | 'group'
  | 'template'
  | 'department'
  | 'location'
  | 'vendor'
  | 'purchase_year'
  | 'policy'
  | 'warranty_status'
  | 'value_bucket'
  | 'asset'
  | 'status'
  | null;

export type WidgetChartType =
  | 'bar'
  | 'horizontal_bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'stacked_bar'
  | 'table'
  | 'kpi';

export type WidgetFilterFieldKey =
  | 'dateFrom'
  | 'dateTo'
  | 'departmentId'
  | 'locationId'
  | 'groupId'
  | 'templateId'
  | 'vendorId'
  | 'status'
  | 'category'
  | 'policyId'
  | 'method'
  | 'purchaseYear'
  | 'warrantyStatus';

export type WidgetFilters = {
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  locationId?: string;
  groupId?: string;
  templateId?: string;
  vendorId?: string;
  status?: string;
  category?: string;
  policyId?: string;
  method?: string;
  purchaseYear?: string;
  warrantyStatus?: string;
};

export type DepreciationWidget = {
  id: string;
  title: string;
  metric: WidgetMetric;
  groupBy: WidgetGroupBy;
  chartType: WidgetChartType;
  filters: WidgetFilters;
  /** Which filter controls are shown on this widget */
  filterFields: WidgetFilterFieldKey[];
  order: number;
  /** Grid column span (1–12) on the dashboard grid */
  colSpan?: number;
  /** Grid row span on the dashboard grid */
  rowSpan?: number;
  /** When true, size stays fixed; when false, size follows displayed data */
  sizeLocked?: boolean;
  /** @deprecated migrated to colSpan */
  width?: 'half' | 'full';
};

export type DepreciationDashboardLayout = {
  version: number;
  widgets: DepreciationWidget[];
};

export type WidgetDataPoint = {
  label: string;
  value: number;
  color?: string;
  stack?: Record<string, number>;
  hint?: string;
};

export const METRIC_OPTIONS: { id: WidgetMetric; label: string }[] = [
  { id: 'purchase_value', label: 'Purchase Value' },
  { id: 'book_value', label: 'Current Book Value' },
  { id: 'depreciation', label: 'Depreciation' },
  { id: 'asset_count', label: 'Asset Count' },
  { id: 'replacement_score', label: 'Replacement Score' },
  { id: 'health_score', label: 'Health Score' },
  { id: 'warranty_status', label: 'Warranty Status' },
  { id: 'issue_count', label: 'Issue Count' },
  { id: 'maintenance_cost', label: 'Maintenance Cost' },
  { id: 'remaining_life', label: 'Remaining Useful Life' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'department', label: 'Department' },
  { id: 'location', label: 'Location' },
  { id: 'group', label: 'Asset Group' },
  { id: 'template', label: 'Template' },
];

export const GROUP_BY_OPTIONS: { id: Exclude<WidgetGroupBy, null>; label: string }[] = [
  { id: 'group', label: 'Asset Group' },
  { id: 'template', label: 'Template' },
  { id: 'department', label: 'Department' },
  { id: 'location', label: 'Location' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'purchase_year', label: 'Purchase Year' },
  { id: 'policy', label: 'Depreciation Policy' },
  { id: 'warranty_status', label: 'Warranty Status' },
  { id: 'status', label: 'Asset Status' },
  { id: 'value_bucket', label: 'Value Range' },
];

export const CHART_TYPE_OPTIONS: { id: WidgetChartType; label: string; needsGroupBy?: boolean }[] = [
  { id: 'kpi', label: 'KPI Card', needsGroupBy: false },
  { id: 'bar', label: 'Bar Chart', needsGroupBy: true },
  { id: 'horizontal_bar', label: 'Horizontal Bar Chart', needsGroupBy: true },
  { id: 'line', label: 'Line Chart', needsGroupBy: true },
  { id: 'area', label: 'Area Chart', needsGroupBy: true },
  { id: 'pie', label: 'Pie Chart', needsGroupBy: true },
  { id: 'donut', label: 'Donut Chart', needsGroupBy: true },
  { id: 'stacked_bar', label: 'Stacked Bar Chart', needsGroupBy: true },
  { id: 'table', label: 'Table', needsGroupBy: true },
];

export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#84cc16', '#ec4899', '#6366f1', '#14b8a6'];

export const WIDGET_FILTER_CATALOG: { key: WidgetFilterFieldKey; label: string }[] = [
  { key: 'dateFrom', label: 'Purchase date from' },
  { key: 'dateTo', label: 'Purchase date to' },
  { key: 'departmentId', label: 'Department' },
  { key: 'locationId', label: 'Location' },
  { key: 'groupId', label: 'Asset group' },
  { key: 'templateId', label: 'Template' },
  { key: 'vendorId', label: 'Vendor' },
  { key: 'status', label: 'Status' },
  { key: 'category', label: 'Category' },
  { key: 'policyId', label: 'Policy' },
  { key: 'method', label: 'Method' },
  { key: 'purchaseYear', label: 'Purchase year' },
  { key: 'warrantyStatus', label: 'Warranty' },
];

const STATUS_OPTIONS = [...DEFAULT_ASSET_STATUSES];

export { STATUS_OPTIONS as WIDGET_STATUS_OPTIONS };

export const WIDGET_GRID_COLS = 12;
export const WIDGET_MIN_COL_SPAN = 3;
export const WIDGET_MAX_COL_SPAN = 12;
export const WIDGET_MIN_ROW_SPAN = 1;
export const WIDGET_MAX_ROW_SPAN = 6;
export const WIDGET_ROW_HEIGHT_PX = 72;

export function clampWidgetSpan(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function migrateWidgetSize(w: DepreciationWidget): Pick<DepreciationWidget, 'colSpan' | 'rowSpan' | 'sizeLocked'> {
  if (w.colSpan != null && w.rowSpan != null) {
    return {
      colSpan: clampWidgetSpan(w.colSpan, WIDGET_MIN_COL_SPAN, WIDGET_MAX_COL_SPAN),
      rowSpan: clampWidgetSpan(w.rowSpan, WIDGET_MIN_ROW_SPAN, WIDGET_MAX_ROW_SPAN),
      sizeLocked: w.sizeLocked ?? false,
    };
  }
  if (w.width === 'full') {
    return { colSpan: 12, rowSpan: 3, sizeLocked: false };
  }
  return { colSpan: 6, rowSpan: 2, sizeLocked: false };
}

function normalizeWidget(w: DepreciationWidget): DepreciationWidget {
  const filters = w.filters ?? {};
  let filterFields = w.filterFields ?? [];
  if (!filterFields.length) {
    const keysWithValues = (Object.keys(filters) as WidgetFilterFieldKey[]).filter(
      (k) => {
        const v = filters[k as keyof WidgetFilters];
        return v != null && v !== '';
      }
    );
    if (keysWithValues.length) filterFields = keysWithValues;
  }
  return { ...w, filterFields, filters, ...migrateWidgetSize(w) };
}

export function colorAt(i: number) {
  return CHART_COLORS[i % CHART_COLORS.length];
}

const REPLACEMENT_SCORES: Record<string, number> = { low: 25, medium: 50, high: 75, critical: 100 };

export function defaultDashboardLayout(): DepreciationDashboardLayout {
  return {
    version: 1,
    widgets: [
      { id: 'dw-1', title: 'Total depreciation', metric: 'depreciation', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 4, rowSpan: 1, sizeLocked: false },
      { id: 'dw-2', title: 'Depreciation %', metric: 'depreciation_pct', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 4, rowSpan: 1, sizeLocked: false },
      { id: 'dw-3', title: 'Fully depreciated', metric: 'fully_depreciated_count', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 2, colSpan: 4, rowSpan: 1, sizeLocked: false },
      { id: 'dw-4', title: 'Purchase vs current', metric: 'purchase_value', groupBy: null, chartType: 'donut', filters: {}, filterFields: [], order: 3, colSpan: 5, rowSpan: 2, sizeLocked: false },
      { id: 'dw-5', title: 'Depreciation by group', metric: 'depreciation', groupBy: 'group', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3, sizeLocked: false },
      { id: 'dw-6', title: 'Book value trend', metric: 'book_value', groupBy: 'purchase_year', chartType: 'line', filters: {}, filterFields: [], order: 5, colSpan: 6, rowSpan: 2, sizeLocked: false },
      { id: 'dw-7', title: 'Value distribution', metric: 'book_value', groupBy: 'value_bucket', chartType: 'donut', filters: {}, filterFields: [], order: 6, colSpan: 5, rowSpan: 2, sizeLocked: false },
      { id: 'dw-8', title: 'Near end of life', metric: 'remaining_life', groupBy: 'asset', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 7, colSpan: 12, rowSpan: 4, sizeLocked: false },
    ],
  };
}

export function mergeDashboardLayout(incoming: Partial<DepreciationDashboardLayout> | null): DepreciationDashboardLayout {
  if (!incoming?.widgets?.length) return defaultDashboardLayout();
  return {
    version: incoming.version ?? 1,
    widgets: [...incoming.widgets].sort((a, b) => a.order - b.order).map(normalizeWidget),
  };
}

function warrantyLabel(a: AssetDepreciationMetrics): string {
  if (a.operational.warrantyActive) return 'Active';
  if (a.operational.warrantyExpiringSoon) return 'Expiring soon';
  return 'Expired / none';
}

function valueBucket(book: number): string {
  if (book < 10000) return 'Under ₹10K';
  if (book < 50000) return '₹10K – ₹50K';
  if (book < 100000) return '₹50K – ₹1L';
  if (book < 500000) return '₹1L – ₹5L';
  return 'Over ₹5L';
}

function getGroupKey(a: AssetDepreciationMetrics, groupBy: WidgetGroupBy): string {
  switch (groupBy) {
    case 'group': return a.groupName || 'Ungrouped';
    case 'template': return a.templateName || 'No template';
    case 'department': return a.department || 'Unassigned';
    case 'location': return a.location || 'Unassigned';
    case 'vendor': return a.vendorName || 'Unassigned';
    case 'purchase_year': return a.purchaseYear ? String(a.purchaseYear) : 'Unknown';
    case 'policy': return a.policy?.name || 'No policy';
    case 'warranty_status': return warrantyLabel(a);
    case 'status': return a.status || 'unknown';
    case 'value_bucket': return valueBucket(a.financial.currentBookValue || 0);
    case 'asset': return a.name || a.assetIdString;
    default: return 'All';
  }
}

function getMetricValue(a: AssetDepreciationMetrics, metric: WidgetMetric): number {
  switch (metric) {
    case 'purchase_value': return a.financial.purchaseCost || 0;
    case 'book_value': return a.financial.currentBookValue || 0;
    case 'depreciation': return a.financial.totalDepreciation || 0;
    case 'asset_count': return 1;
    case 'replacement_score': return REPLACEMENT_SCORES[a.operational.replacementPriority] ?? 50;
    case 'health_score': return a.operational.healthScore || 0;
    case 'issue_count': return a.operational.issueCount || 0;
    case 'maintenance_cost': return a.operational.maintenanceCount || 0;
    case 'remaining_life': return a.operational.estimatedRemainingUsefulLife || 0;
    case 'warranty_status':
    case 'vendor':
    case 'department':
    case 'location':
    case 'group':
    case 'template':
      return 1;
    default:
      return 0;
  }
}

function isAvgMetric(metric: WidgetMetric): boolean {
  return metric === 'health_score' || metric === 'replacement_score';
}

export function applyWidgetFilters(
  assets: AssetDepreciationMetrics[],
  widgetFilters: WidgetFilters
): AssetDepreciationMetrics[] {
  return assets.filter((a) => {
    if (widgetFilters.departmentId && a.departmentId !== widgetFilters.departmentId) return false;
    if (widgetFilters.locationId && a.locationId !== widgetFilters.locationId) return false;
    if (widgetFilters.groupId && a.groupId !== widgetFilters.groupId) return false;
    if (widgetFilters.templateId && a.templateId !== widgetFilters.templateId) return false;
    if (widgetFilters.vendorId && a.vendorId !== widgetFilters.vendorId) return false;
    if (widgetFilters.status && a.status !== widgetFilters.status) return false;
    if (widgetFilters.category && a.category !== widgetFilters.category) return false;
    if (widgetFilters.policyId && a.policy?.id !== widgetFilters.policyId) return false;
    if (widgetFilters.method) {
      const m = a.policy?.method || a.financial.method;
      if (m !== widgetFilters.method) return false;
    }
    if (widgetFilters.purchaseYear && String(a.purchaseYear ?? '') !== widgetFilters.purchaseYear) return false;
    if (widgetFilters.warrantyStatus) {
      const ws = widgetFilters.warrantyStatus;
      if (ws === 'active' && !a.operational.warrantyActive) return false;
      if (ws === 'expiring' && !a.operational.warrantyExpiringSoon) return false;
      if (ws === 'expired' && (a.operational.warrantyActive || a.operational.warrantyExpiringSoon)) return false;
    }
    if (widgetFilters.dateFrom && a.purchaseDate) {
      if (new Date(a.purchaseDate) < new Date(widgetFilters.dateFrom)) return false;
    }
    if (widgetFilters.dateTo && a.purchaseDate) {
      const end = new Date(widgetFilters.dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(a.purchaseDate) > end) return false;
    }
    return true;
  });
}

export type WidgetResult = {
  kpiValue?: string;
  kpiHint?: string;
  points: WidgetDataPoint[];
  tableRows?: { label: string; value: string; count?: number }[];
  comparison?: { original: number; current: number };
};

export function suggestWidgetSize(
  widget: DepreciationWidget,
  result: WidgetResult
): { colSpan: number; rowSpan: number } {
  const pointCount = result.points.length || result.tableRows?.length || 0;
  const filterRows = Math.ceil((widget.filterFields?.length ?? 0) / 3);
  const filterBoost = filterRows > 0 ? 1 : 0;

  if (widget.chartType === 'kpi') {
    return {
      colSpan: 4,
      rowSpan: clampWidgetSpan(1 + filterBoost, WIDGET_MIN_ROW_SPAN, WIDGET_MAX_ROW_SPAN),
    };
  }

  if (widget.chartType === 'table') {
    const rows = result.tableRows?.length ?? 0;
    return {
      colSpan: clampWidgetSpan(6 + Math.min(rows, 4), WIDGET_MIN_COL_SPAN, WIDGET_MAX_COL_SPAN),
      rowSpan: clampWidgetSpan(2 + Math.ceil(rows / 6) + filterBoost, WIDGET_MIN_ROW_SPAN, WIDGET_MAX_ROW_SPAN),
    };
  }

  if (widget.chartType === 'horizontal_bar' || widget.chartType === 'stacked_bar') {
    const items = Math.min(pointCount, 12);
    return {
      colSpan: items > 8 ? 8 : 6,
      rowSpan: clampWidgetSpan(2 + Math.ceil(items / 3) + filterBoost, WIDGET_MIN_ROW_SPAN, WIDGET_MAX_ROW_SPAN),
    };
  }

  if (widget.chartType === 'bar') {
    const bars = Math.min(pointCount, 12);
    return {
      colSpan: clampWidgetSpan(4 + Math.min(bars, 6), WIDGET_MIN_COL_SPAN, WIDGET_MAX_COL_SPAN),
      rowSpan: clampWidgetSpan(2 + filterBoost, WIDGET_MIN_ROW_SPAN, WIDGET_MAX_ROW_SPAN),
    };
  }

  if (widget.chartType === 'line' || widget.chartType === 'area') {
    const years = pointCount;
    return {
      colSpan: clampWidgetSpan(5 + Math.min(years, 4), WIDGET_MIN_COL_SPAN, WIDGET_MAX_COL_SPAN),
      rowSpan: clampWidgetSpan(2 + filterBoost, WIDGET_MIN_ROW_SPAN, WIDGET_MAX_ROW_SPAN),
    };
  }

  if (widget.chartType === 'donut' || widget.chartType === 'pie') {
    const segments = Math.max(pointCount, 2);
    return {
      colSpan: segments > 6 ? 6 : 5,
      rowSpan: clampWidgetSpan(2 + (segments > 5 ? 1 : 0) + filterBoost, WIDGET_MIN_ROW_SPAN, WIDGET_MAX_ROW_SPAN),
    };
  }

  return {
    colSpan: 6,
    rowSpan: clampWidgetSpan(2 + filterBoost, WIDGET_MIN_ROW_SPAN, WIDGET_MAX_ROW_SPAN),
  };
}

export function effectiveWidgetSize(
  widget: DepreciationWidget,
  result: WidgetResult
): { colSpan: number; rowSpan: number } {
  const migrated = migrateWidgetSize(widget);
  if (widget.sizeLocked) {
    return { colSpan: migrated.colSpan!, rowSpan: migrated.rowSpan! };
  }
  return suggestWidgetSize(widget, result);
}

export function computeWidgetData(
  assets: AssetDepreciationMetrics[],
  widget: DepreciationWidget
): WidgetResult {
  let filtered = applyWidgetFilters(assets, widget.filters);
  const { metric, groupBy, chartType } = widget;

  if (metric === 'remaining_life' && (groupBy === 'asset' || !groupBy)) {
    filtered = filtered.filter((a) => a.indicators?.nearEndOfLife || a.indicators?.replacementRecommended);
  }

  if (chartType === 'kpi' || metric === 'depreciation_pct' || metric === 'fully_depreciated_count') {
    const purchase = filtered.reduce((s, a) => s + (a.financial.purchaseCost || 0), 0);
    const book = filtered.reduce((s, a) => s + (a.financial.currentBookValue || 0), 0);
    const dep = purchase - book;
    if (metric === 'depreciation_pct') {
      const pct = purchase > 0 ? ((dep / purchase) * 100).toFixed(1) : '0';
      return { kpiValue: `${pct}%`, points: [] };
    }
    if (metric === 'fully_depreciated_count') {
      const n = filtered.filter((a) => a.indicators.fullyDepreciated).length;
      return { kpiValue: String(n), kpiHint: `of ${filtered.length} assets`, points: [] };
    }
    const val = metric === 'depreciation' ? dep
      : metric === 'purchase_value' ? purchase
      : metric === 'book_value' ? book
      : metric === 'asset_count' ? filtered.length
      : metric === 'health_score' && filtered.length
        ? Math.round(filtered.reduce((s, a) => s + a.operational.healthScore, 0) / filtered.length)
        : metric === 'issue_count'
          ? filtered.reduce((s, a) => s + a.operational.issueCount, 0)
          : filtered.reduce((s, a) => s + getMetricValue(a, metric), 0);
    return {
      kpiValue: ['purchase_value', 'book_value', 'depreciation'].includes(metric)
        ? formatINR(val as number)
        : String(val),
      points: [],
    };
  }

  if (chartType === 'donut' && !groupBy && metric === 'purchase_value') {
    const purchase = filtered.reduce((s, a) => s + a.financial.purchaseCost, 0);
    const book = filtered.reduce((s, a) => s + a.financial.currentBookValue, 0);
    return {
      points: [
        { label: 'Current book value', value: book, color: '#10b981' },
        { label: 'Depreciation', value: Math.max(0, purchase - book), color: '#f43f5e' },
      ].filter((p) => p.value > 0),
      comparison: { original: purchase, current: book },
    };
  }

  const effectiveGroupBy: WidgetGroupBy = groupBy
    || (['vendor', 'department', 'location', 'group', 'template', 'warranty_status'].includes(metric)
      ? (metric as WidgetGroupBy)
      : 'group');

  const buckets: Record<string, { sum: number; count: number; book: number; purchase: number }> = {};

  for (const a of filtered) {
    const key = getGroupKey(a, effectiveGroupBy);
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0, book: 0, purchase: 0 };
    buckets[key].sum += getMetricValue(a, metric);
    buckets[key].count += 1;
    buckets[key].book += a.financial.currentBookValue || 0;
    buckets[key].purchase += a.financial.purchaseCost || 0;
  }

  let points: WidgetDataPoint[] = Object.entries(buckets).map(([label, b], i) => {
    const value = isAvgMetric(metric) && b.count > 0 ? Math.round((b.sum / b.count) * 10) / 10 : Math.round(b.sum * 100) / 100;
    let stack: Record<string, number> | undefined;
    if (chartType === 'stacked_bar') {
      stack = { 'Book value': b.book, Depreciation: Math.max(0, b.purchase - b.book) };
    } else if (effectiveGroupBy === 'purchase_year') {
      stack = { 'Book value': b.book, Purchase: b.purchase };
    }
    return {
      label,
      value,
      color: colorAt(i),
      stack,
      hint: `${b.count} assets`,
    };
  });

  if (effectiveGroupBy === 'purchase_year') {
    points = points.sort((a, b) => Number(a.label) - Number(b.label));
  } else if (metric === 'remaining_life' || effectiveGroupBy === 'asset') {
    points = points.sort((a, b) => a.value - b.value).slice(0, 12);
  } else {
    points = points.sort((a, b) => b.value - a.value);
  }

  if (chartType === 'table') {
    return {
      points,
      tableRows: points.map((p) => ({
        label: p.label,
        value: formatMetricValue(p.value, metric),
        count: Number(p.hint?.replace(/\D/g, '') || 0) || undefined,
      })),
    };
  }

  return { points };
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatMetricValue(n: number, metric: WidgetMetric): string {
  if (['purchase_value', 'book_value', 'depreciation'].includes(metric)) return formatINR(n);
  if (metric === 'remaining_life') return `${n.toFixed(1)}y`;
  if (isAvgMetric(metric)) return `${n}%`;
  return String(n);
}

export function formatWidgetValue(n: number, metric: WidgetMetric): string {
  return formatMetricValue(n, metric);
}

export function newWidget(partial?: Partial<DepreciationWidget>): DepreciationWidget {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `w-${Date.now()}`;
  return {
    id,
    title: 'New widget',
    metric: 'asset_count',
    groupBy: 'group',
    chartType: 'bar',
    filters: {},
    filterFields: [],
    order: 0,
    colSpan: 6,
    rowSpan: 2,
    sizeLocked: false,
    ...partial,
  };
}

export function reorderWidgets(widgets: DepreciationWidget[], fromId: string, toId: string): DepreciationWidget[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const fromIdx = sorted.findIndex((w) => w.id === fromId);
  const toIdx = sorted.findIndex((w) => w.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return sorted;
  const [moved] = sorted.splice(fromIdx, 1);
  sorted.splice(toIdx, 0, moved);
  return sorted.map((w, i) => ({ ...w, order: i }));
}
