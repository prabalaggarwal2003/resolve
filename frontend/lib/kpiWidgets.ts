import { isActiveAssetStatus } from '@/lib/assetStatuses';

export type KpiAssetMetrics = {
  assetId: string;
  assetIdString: string;
  name: string;
  category: string;
  status?: string;
  condition?: string;
  templateId?: string | null;
  templateName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  departmentId?: string | null;
  department?: string;
  locationId?: string | null;
  location?: string;
  vendorId?: string | null;
  vendorName?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  purchaseDate?: string;
  purchaseYear?: number | null;
  createdAt?: string;
  purchaseValue: number;
  currentValue: number;
  depreciation: number;
  replacementValue: number;
  issueCount: number;
  openIssueCount: number;
  maintenanceCost: number;
  healthScore: number;
  replacementScore: number;
  replacementPriority: string;
  utilization: number;
  isAssigned: boolean;
  isActive: boolean;
  isRetired: boolean;
  warrantyStatus: string;
  warrantyActive: boolean;
  warrantyExpiringSoon: boolean;
  ageYears: number;
};

export type KpiTotals = {
  totalAssets: number;
  activeAssets: number;
  assetsAddedThisMonth: number;
  assetsRetired: number;
  utilizationPct: number;
  averageAssetAge: number;
  totalPurchaseValue: number;
  currentBookValue: number;
  totalDepreciation: number;
  replacementValue: number;
  averageAssetCost: number;
  warrantyActive: number;
  warrantyExpiring: number;
  warrantyExpired: number;
};

export type KpiQuickData = {
  latestIssues: Array<{ id: string; title: string; status: string; assetName: string; createdAt: string }>;
  recentAssets: Array<{ id: string; name: string; assetIdString: string; status: string }>;
  upcomingMaintenance: Array<{ id: string; name: string; assetIdString: string; nextMaintenanceDate: string }>;
  warrantyExpiringSoon: Array<{ id: string; name: string; assetIdString: string; warrantyExpiry: string }>;
  recentMovements: Array<{ id: string; type: string; assetName: string; userName: string; createdAt: string }>;
  recentAuditLogs: Array<{ id: string; action: string; resource: string; description: string; userName: string; createdAt: string }>;
  recentlyAddedAssets: Array<{ id: string; name: string; assetIdString: string; category: string; createdAt: string }>;
  topVendors: Array<{ name: string; count: number; totalValue: number }>;
  lowHealthAssets: Array<{ id: string; name: string; assetIdString: string; healthScore: number; status: string }>;
  replacementRecommendations: Array<{ id: string; name: string; assetIdString: string; replacementScore: number; priority: string }>;
};

export type KpiMetric =
  | 'total_assets' | 'active_assets' | 'assets_added_month' | 'assets_retired' | 'utilization_pct' | 'average_age'
  | 'total_purchase' | 'current_value' | 'total_depreciation' | 'replacement_value' | 'average_cost'
  | 'warranty_active' | 'warranty_expiring' | 'warranty_expired'
  | 'asset_count' | 'purchase_value' | 'book_value' | 'depreciation' | 'issues' | 'maintenance_cost'
  | 'health_score' | 'replacement_score' | 'utilization' | 'warranty';

export type KpiGroupBy =
  | 'group' | 'template' | 'category' | 'department' | 'location' | 'vendor'
  | 'purchase_year' | 'status' | 'condition' | 'assigned_user' | 'warranty_status' | null;

export type KpiChartType =
  | 'kpi' | 'bar' | 'horizontal_bar' | 'line' | 'area' | 'pie' | 'donut'
  | 'stacked_bar' | 'table' | 'progress_ring' | 'gauge';

export type KpiQuickType =
  | 'latest_issues' | 'recent_assets' | 'upcoming_maintenance' | 'warranty_expiring_soon'
  | 'recent_movements' | 'recent_audit_logs' | 'recently_added_assets' | 'top_vendors'
  | 'low_health_assets' | 'replacement_recommendations';

export type KpiFilterFieldKey =
  | 'dateFrom' | 'dateTo' | 'departmentId' | 'locationId' | 'groupId' | 'templateId'
  | 'vendorId' | 'status' | 'category' | 'purchaseYear' | 'warrantyStatus' | 'condition' | 'assignedUserId';

export type KpiWidgetFilters = Partial<Record<KpiFilterFieldKey, string>>;

export type KpiWidget = {
  id: string;
  title: string;
  kind: 'metric' | 'quick';
  metric?: KpiMetric;
  groupBy?: KpiGroupBy;
  chartType?: KpiChartType;
  quickType?: KpiQuickType;
  filters: KpiWidgetFilters;
  filterFields: KpiFilterFieldKey[];
  timeRange?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  order: number;
  colSpan?: number;
  rowSpan?: number;
  sizeLocked?: boolean;
};

export type KpiDashboardLayout = { version: number; widgets: KpiWidget[] };

export type KpiDashboard = {
  _id: string;
  name: string;
  description?: string;
  scope: 'personal' | 'organization';
  ownerId?: string;
  templateId?: string | null;
  allowedRoleIds?: string[];
  autoRefresh: 'manual' | '1m' | '5m' | '15m';
  layout: KpiDashboardLayout;
  updatedAt?: string;
};

export type KpiDataContext = {
  assets: KpiAssetMetrics[];
  totals: KpiTotals;
  quick: KpiQuickData;
};

export type KpiWidgetResult = {
  kpiValue?: string;
  kpiHint?: string;
  points: { label: string; value: number; color?: string; hint?: string }[];
  tableRows?: { label: string; value: string }[];
  listRows?: { primary: string; secondary?: string; meta?: string }[];
  gaugeValue?: number;
  gaugeMax?: number;
};

export const KPI_GRID_COLS = 12;
export const KPI_MIN_COL_SPAN = 3;
export const KPI_MAX_COL_SPAN = 12;
export const KPI_MIN_ROW_SPAN = 1;
export const KPI_MAX_ROW_SPAN = 6;
export const KPI_ROW_HEIGHT_PX = 72;

export const METRIC_OPTIONS: { id: KpiMetric; label: string; category: string }[] = [
  { id: 'total_assets', label: 'Total Assets', category: 'Assets' },
  { id: 'active_assets', label: 'Active Assets', category: 'Assets' },
  { id: 'assets_added_month', label: 'Assets Added This Month', category: 'Assets' },
  { id: 'assets_retired', label: 'Assets Retired', category: 'Assets' },
  { id: 'utilization_pct', label: 'Asset Utilization %', category: 'Assets' },
  { id: 'average_age', label: 'Average Asset Age', category: 'Assets' },
  { id: 'total_purchase', label: 'Total Purchase Value', category: 'Financial' },
  { id: 'current_value', label: 'Current Book Value', category: 'Financial' },
  { id: 'total_depreciation', label: 'Total Depreciation', category: 'Financial' },
  { id: 'replacement_value', label: 'Replacement Value', category: 'Financial' },
  { id: 'average_cost', label: 'Average Asset Cost', category: 'Financial' },
  { id: 'warranty_active', label: 'Warranty Active', category: 'Warranty' },
  { id: 'warranty_expiring', label: 'Warranty Expiring', category: 'Warranty' },
  { id: 'warranty_expired', label: 'Warranty Expired', category: 'Warranty' },
  { id: 'asset_count', label: 'Asset Count', category: 'Metrics' },
  { id: 'purchase_value', label: 'Purchase Value', category: 'Metrics' },
  { id: 'book_value', label: 'Current Value', category: 'Metrics' },
  { id: 'depreciation', label: 'Depreciation', category: 'Metrics' },
  { id: 'issues', label: 'Issues', category: 'Metrics' },
  { id: 'maintenance_cost', label: 'Maintenance Cost', category: 'Metrics' },
  { id: 'health_score', label: 'Health Score', category: 'Metrics' },
  { id: 'replacement_score', label: 'Replacement Score', category: 'Metrics' },
  { id: 'utilization', label: 'Utilization', category: 'Metrics' },
  { id: 'warranty', label: 'Warranty', category: 'Metrics' },
];

export const GROUP_BY_OPTIONS: { id: NonNullable<KpiGroupBy>; label: string }[] = [
  { id: 'group', label: 'Asset Group' },
  { id: 'template', label: 'Template' },
  { id: 'category', label: 'Category' },
  { id: 'department', label: 'Department' },
  { id: 'location', label: 'Location' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'purchase_year', label: 'Purchase Year' },
  { id: 'status', label: 'Status' },
  { id: 'condition', label: 'Condition' },
  { id: 'assigned_user', label: 'Assigned User' },
  { id: 'warranty_status', label: 'Warranty Status' },
];

export const CHART_TYPE_OPTIONS: { id: KpiChartType; label: string; needsGroupBy?: boolean }[] = [
  { id: 'kpi', label: 'KPI Card', needsGroupBy: false },
  { id: 'bar', label: 'Bar', needsGroupBy: true },
  { id: 'horizontal_bar', label: 'Horizontal Bar', needsGroupBy: true },
  { id: 'line', label: 'Line', needsGroupBy: true },
  { id: 'area', label: 'Area', needsGroupBy: true },
  { id: 'pie', label: 'Pie', needsGroupBy: true },
  { id: 'donut', label: 'Donut', needsGroupBy: true },
  { id: 'stacked_bar', label: 'Stacked Bar', needsGroupBy: true },
  { id: 'table', label: 'Table', needsGroupBy: true },
  { id: 'progress_ring', label: 'Progress Ring', needsGroupBy: false },
  { id: 'gauge', label: 'Gauge', needsGroupBy: false },
];

export const QUICK_WIDGET_OPTIONS: { id: KpiQuickType; label: string }[] = [
  { id: 'latest_issues', label: 'Latest Issues' },
  { id: 'recent_assets', label: 'Recent Assets' },
  { id: 'upcoming_maintenance', label: 'Upcoming Maintenance' },
  { id: 'warranty_expiring_soon', label: 'Warranty Expiring Soon' },
  { id: 'recent_movements', label: 'Recent Asset Movements' },
  { id: 'recent_audit_logs', label: 'Recent Audit Logs' },
  { id: 'recently_added_assets', label: 'Recently Added Assets' },
  { id: 'top_vendors', label: 'Top Vendors' },
  { id: 'low_health_assets', label: 'Low Health Assets' },
  { id: 'replacement_recommendations', label: 'Replacement Recommendations' },
];

export const WIDGET_FILTER_CATALOG: { key: KpiFilterFieldKey; label: string }[] = [
  { key: 'dateFrom', label: 'Date from' },
  { key: 'dateTo', label: 'Date to' },
  { key: 'departmentId', label: 'Department' },
  { key: 'locationId', label: 'Location' },
  { key: 'groupId', label: 'Asset group' },
  { key: 'templateId', label: 'Template' },
  { key: 'vendorId', label: 'Vendor' },
  { key: 'status', label: 'Status' },
  { key: 'category', label: 'Category' },
  { key: 'purchaseYear', label: 'Purchase year' },
  { key: 'warrantyStatus', label: 'Warranty' },
  { key: 'condition', label: 'Condition' },
  { key: 'assignedUserId', label: 'Assigned user' },
];

export const WIDGET_LIBRARY: { category: string; items: { title: string; widget: Partial<KpiWidget> }[] }[] = [
  {
    category: 'Assets',
    items: [
      { title: 'Total Assets', widget: { kind: 'metric', metric: 'total_assets', chartType: 'kpi' } },
      { title: 'Asset Growth', widget: { kind: 'metric', metric: 'assets_added_month', chartType: 'kpi' } },
      { title: 'Asset Distribution', widget: { kind: 'metric', metric: 'asset_count', groupBy: 'category', chartType: 'donut' } },
      { title: 'Asset Utilization', widget: { kind: 'metric', metric: 'utilization_pct', chartType: 'gauge' } },
    ],
  },
  {
    category: 'Financial',
    items: [
      { title: 'Purchase Value', widget: { kind: 'metric', metric: 'total_purchase', chartType: 'kpi' } },
      { title: 'Book Value', widget: { kind: 'metric', metric: 'current_value', chartType: 'kpi' } },
      { title: 'Depreciation', widget: { kind: 'metric', metric: 'total_depreciation', chartType: 'kpi' } },
    ],
  },
  {
    category: 'Warranty',
    items: [
      { title: 'Expiring Warranties', widget: { kind: 'quick', quickType: 'warranty_expiring_soon' } },
      { title: 'Warranty Coverage', widget: { kind: 'metric', metric: 'warranty', groupBy: 'warranty_status', chartType: 'donut' } },
    ],
  },
  {
    category: 'Locations',
    items: [
      { title: 'Assets by Location', widget: { kind: 'metric', metric: 'asset_count', groupBy: 'location', chartType: 'horizontal_bar' } },
      { title: 'Issues by Location', widget: { kind: 'metric', metric: 'issues', groupBy: 'location', chartType: 'bar' } },
    ],
  },
  {
    category: 'Vendors',
    items: [
      { title: 'Vendor Performance', widget: { kind: 'quick', quickType: 'top_vendors' } },
      { title: 'Assets by Vendor', widget: { kind: 'metric', metric: 'asset_count', groupBy: 'vendor', chartType: 'bar' } },
    ],
  },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#84cc16', '#ec4899'];

function colorAt(i: number) {
  return COLORS[i % COLORS.length];
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function clampKpiSpan(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function eqFilterId(assetValue?: string | null, filterValue?: string) {
  if (!filterValue) return true;
  if (assetValue == null) return false;
  return String(assetValue) === String(filterValue);
}

export function applyKpiWidgetFilters(assets: KpiAssetMetrics[], filters?: KpiWidgetFilters) {
  const f = filters ?? {};
  return assets.filter((a) => {
    if (!eqFilterId(a.departmentId, f.departmentId)) return false;
    if (!eqFilterId(a.locationId, f.locationId)) return false;
    if (!eqFilterId(a.groupId, f.groupId)) return false;
    if (!eqFilterId(a.templateId, f.templateId)) return false;
    if (!eqFilterId(a.vendorId, f.vendorId)) return false;
    if (!eqFilterId(a.assignedToId, f.assignedUserId)) return false;
    if (f.status && a.status !== f.status) return false;
    if (f.category && a.category !== f.category) return false;
    if (f.condition && a.condition !== f.condition) return false;
    if (f.purchaseYear && String(a.purchaseYear ?? '') !== f.purchaseYear) return false;
    if (f.warrantyStatus && a.warrantyStatus !== f.warrantyStatus) return false;
    if (f.dateFrom && a.purchaseDate && new Date(a.purchaseDate) < new Date(f.dateFrom)) return false;
    if (f.dateTo && a.purchaseDate) {
      const end = new Date(f.dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(a.purchaseDate) > end) return false;
    }
    return true;
  });
}

function getGroupKey(a: KpiAssetMetrics, groupBy: KpiGroupBy): string {
  switch (groupBy) {
    case 'group': return a.groupName || 'Ungrouped';
    case 'template': return a.templateName || 'No template';
    case 'category': return a.category || 'Uncategorized';
    case 'department': return a.department || 'Unassigned';
    case 'location': return a.location || 'Unassigned';
    case 'vendor': return a.vendorName || 'Unassigned';
    case 'purchase_year': return a.purchaseYear ? String(a.purchaseYear) : 'Unknown';
    case 'status': return a.status || 'unknown';
    case 'condition': return a.condition || 'unknown';
    case 'assigned_user': return a.assignedToName || 'Unassigned';
    case 'warranty_status': return a.warrantyStatus || 'none';
    default: return 'All';
  }
}

function getMetricValue(a: KpiAssetMetrics, metric: KpiMetric): number {
  switch (metric) {
    case 'asset_count': return 1;
    case 'purchase_value': return a.purchaseValue;
    case 'book_value': case 'current_value': return a.currentValue;
    case 'depreciation': return a.depreciation;
    case 'issues': return a.issueCount;
    case 'maintenance_cost': return a.maintenanceCost;
    case 'health_score': return a.healthScore;
    case 'replacement_score': return a.replacementScore;
    case 'utilization': return a.utilization;
    case 'warranty': return a.warrantyActive ? 1 : 0;
    default: return 0;
  }
}

function aggregateKpiFromAssets(assets: KpiAssetMetrics[], metric: KpiMetric): number {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  switch (metric) {
    case 'total_assets': return assets.length;
    case 'active_assets': return assets.filter((a) => isActiveAssetStatus(a.status)).length;
    case 'assets_added_month':
      return assets.filter((a) => a.createdAt && new Date(a.createdAt) >= monthStart).length;
    case 'assets_retired': return assets.filter((a) => a.isRetired).length;
    case 'utilization_pct':
      return assets.length
        ? Math.round((assets.filter((a) => a.isAssigned).length / assets.length) * 1000) / 10
        : 0;
    case 'average_age':
      return assets.length
        ? Math.round((assets.reduce((s, a) => s + a.ageYears, 0) / assets.length) * 10) / 10
        : 0;
    case 'total_purchase': return assets.reduce((s, a) => s + a.purchaseValue, 0);
    case 'current_value': return assets.reduce((s, a) => s + a.currentValue, 0);
    case 'total_depreciation': return assets.reduce((s, a) => s + a.depreciation, 0);
    case 'replacement_value': return assets.reduce((s, a) => s + a.replacementValue, 0);
    case 'average_cost':
      return assets.length
        ? Math.round(assets.reduce((s, a) => s + a.purchaseValue, 0) / assets.length)
        : 0;
    case 'warranty_active': return assets.filter((a) => a.warrantyStatus === 'active').length;
    case 'warranty_expiring': return assets.filter((a) => a.warrantyStatus === 'expiring').length;
    case 'warranty_expired': return assets.filter((a) => a.warrantyStatus === 'expired').length;
    default: return 0;
  }
}

export function formatKpiAggregate(metric: KpiMetric, value: number): string {
  if (['total_purchase', 'current_value', 'total_depreciation', 'replacement_value', 'average_cost', 'purchase_value', 'book_value', 'depreciation'].includes(metric)) {
    return formatINR(value);
  }
  if (metric === 'utilization_pct' || metric === 'utilization') return `${value}%`;
  if (metric === 'average_age') return `${value}y`;
  return String(Math.round(value));
}

export function computeKpiWidgetData(ctx: KpiDataContext, widget: KpiWidget): KpiWidgetResult {
  const filtered = applyKpiWidgetFilters(ctx.assets, widget.filters);

  if (widget.kind === 'quick' && widget.quickType) {
    return computeQuickWidget(ctx.quick, widget.quickType, widget.limit || 8, filtered);
  }

  const metric = widget.metric || 'asset_count';
  const chartType = widget.chartType || 'kpi';

  const aggregateMetrics: KpiMetric[] = [
    'total_assets', 'active_assets', 'assets_added_month', 'assets_retired', 'utilization_pct', 'average_age',
    'total_purchase', 'current_value', 'total_depreciation', 'replacement_value', 'average_cost',
    'warranty_active', 'warranty_expiring', 'warranty_expired',
  ];

  if (chartType === 'kpi' || chartType === 'gauge' || chartType === 'progress_ring') {
    const val = aggregateMetrics.includes(metric)
      ? aggregateKpiFromAssets(filtered, metric)
      : metric === 'asset_count'
        ? filtered.length
        : ['health_score', 'replacement_score', 'utilization'].includes(metric) && filtered.length
          ? Math.round(filtered.reduce((s, a) => s + getMetricValue(a, metric), 0) / filtered.length)
          : filtered.reduce((s, a) => s + getMetricValue(a, metric), 0);

    if (chartType === 'gauge' || chartType === 'progress_ring') {
      const max = metric === 'utilization_pct' || metric === 'utilization' ? 100 : Math.max(val * 1.2, 1);
      return { kpiValue: formatKpiAggregate(metric, val), gaugeValue: val, gaugeMax: max, points: [] };
    }
    return { kpiValue: formatKpiAggregate(metric, val), points: [] };
  }

  const groupBy = widget.groupBy || 'category';
  const buckets: Record<string, { sum: number; count: number }> = {};
  for (const a of filtered) {
    const key = getGroupKey(a, groupBy);
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
    buckets[key].sum += getMetricValue(a, metric);
    buckets[key].count += 1;
  }

  let points = Object.entries(buckets).map(([label, b], i) => ({
    label,
    value: ['health_score', 'replacement_score', 'utilization'].includes(metric) && b.count
      ? Math.round((b.sum / b.count) * 10) / 10
      : Math.round(b.sum * 100) / 100,
    color: colorAt(i),
    hint: `${b.count} assets`,
  }));

  const sortDesc = widget.sortOrder !== 'asc';
  points = points.sort((a, b) => sortDesc ? b.value - a.value : a.value - b.value);
  const limit = widget.limit || 12;
  points = points.slice(0, limit);

  if (chartType === 'table') {
    return {
      points,
      tableRows: points.map((p) => ({
        label: p.label,
        value: formatKpiAggregate(metric, p.value),
      })),
    };
  }

  return { points };
}

function computeQuickWidget(
  quick: KpiQuickData,
  type: KpiQuickType,
  limit: number,
  assets: KpiAssetMetrics[],
): KpiWidgetResult {
  const rows: KpiWidgetResult['listRows'] = [];
  const assetIds = new Set(assets.map((a) => a.assetId));

  switch (type) {
    case 'latest_issues':
      quick.latestIssues.slice(0, limit * 3).forEach((i) => {
        const match = assets.some((a) => a.name === i.assetName);
        if (match) rows.push({ primary: i.title, secondary: i.assetName, meta: i.status });
      });
      break;
    case 'recent_assets':
      quick.recentAssets.filter((a) => assetIds.has(a.id)).slice(0, limit).forEach((a) => rows.push({ primary: a.name, secondary: a.assetIdString, meta: a.status }));
      break;
    case 'upcoming_maintenance':
      quick.upcomingMaintenance.filter((a) => assetIds.has(a.id)).slice(0, limit).forEach((a) => rows.push({ primary: a.name, secondary: a.assetIdString, meta: new Date(a.nextMaintenanceDate).toLocaleDateString() }));
      break;
    case 'warranty_expiring_soon':
      quick.warrantyExpiringSoon.filter((a) => assetIds.has(a.id)).slice(0, limit).forEach((a) => rows.push({ primary: a.name, secondary: a.assetIdString, meta: new Date(a.warrantyExpiry).toLocaleDateString() }));
      break;
    case 'recent_movements':
      quick.recentMovements.slice(0, limit * 3).forEach((m) => {
        const match = assets.some((a) => a.name === m.assetName);
        if (match) rows.push({ primary: m.assetName, secondary: m.type, meta: m.userName });
      });
      break;
    case 'recent_audit_logs':
      quick.recentAuditLogs.slice(0, limit).forEach((l) => rows.push({ primary: l.description || l.action, secondary: l.resource, meta: l.userName }));
      break;
    case 'recently_added_assets':
      quick.recentlyAddedAssets.filter((a) => assetIds.has(a.id)).slice(0, limit).forEach((a) => rows.push({ primary: a.name, secondary: a.category, meta: a.assetIdString }));
      break;
    case 'top_vendors': {
      const vendorMap = new Map<string, { count: number; totalValue: number }>();
      for (const a of assets) {
        const name = a.vendorName || 'Unassigned';
        const cur = vendorMap.get(name) || { count: 0, totalValue: 0 };
        cur.count += 1;
        cur.totalValue += a.purchaseValue;
        vendorMap.set(name, cur);
      }
      Array.from(vendorMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)
        .forEach(([name, v]) => rows.push({ primary: name, secondary: `${v.count} assets`, meta: formatINR(v.totalValue) }));
      break;
    }
    case 'low_health_assets':
      [...assets].sort((a, b) => a.healthScore - b.healthScore).slice(0, limit).forEach((a) => rows.push({ primary: a.name, secondary: a.assetIdString, meta: `Health ${a.healthScore}` }));
      break;
    case 'replacement_recommendations':
      assets.filter((a) => a.replacementScore >= 75).sort((a, b) => b.replacementScore - a.replacementScore).slice(0, limit).forEach((a) => rows.push({ primary: a.name, secondary: a.replacementPriority, meta: `Score ${a.replacementScore}` }));
      break;
  }
  return { listRows: rows.slice(0, limit), points: [] };
}

export function newKpiWidget(partial?: Partial<KpiWidget>): KpiWidget {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `kw-${Date.now()}`;
  return {
    id,
    title: 'New widget',
    kind: 'metric',
    metric: 'asset_count',
    groupBy: 'category',
    chartType: 'bar',
    filters: {},
    filterFields: [],
    sortOrder: 'desc',
    limit: 10,
    order: 0,
    colSpan: 6,
    rowSpan: 2,
    sizeLocked: false,
    ...partial,
  };
}

export function reorderKpiWidgets(widgets: KpiWidget[], fromId: string, toId: string): KpiWidget[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const fromIdx = sorted.findIndex((w) => w.id === fromId);
  const toIdx = sorted.findIndex((w) => w.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return sorted;
  const [moved] = sorted.splice(fromIdx, 1);
  sorted.splice(toIdx, 0, moved);
  return sorted.map((w, i) => ({ ...w, order: i }));
}

export function suggestKpiWidgetSize(widget: KpiWidget, result: KpiWidgetResult): { colSpan: number; rowSpan: number } {
  if (widget.kind === 'quick') return { colSpan: 6, rowSpan: 3 };
  if (widget.chartType === 'kpi' || widget.chartType === 'gauge' || widget.chartType === 'progress_ring') {
    return { colSpan: 3, rowSpan: 1 + (widget.filterFields?.length ? 1 : 0) };
  }
  const n = result.points.length || result.listRows?.length || 0;
  return { colSpan: 6, rowSpan: clampKpiSpan(2 + Math.ceil(n / 4), KPI_MIN_ROW_SPAN, KPI_MAX_ROW_SPAN) };
}

export function mergeKpiLayout(incoming: Partial<KpiDashboardLayout> | null | undefined): KpiDashboardLayout {
  if (!incoming?.widgets?.length) {
    return { version: 1, widgets: [] };
  }
  return {
    version: incoming.version ?? 1,
    widgets: [...incoming.widgets].sort((a, b) => a.order - b.order).map((w) => ({
      ...w,
      filterFields: w.filterFields ?? [],
      filters: w.filters ?? {},
      colSpan: w.colSpan ?? 6,
      rowSpan: w.rowSpan ?? 2,
      sizeLocked: w.sizeLocked ?? false,
    })),
  };
}
