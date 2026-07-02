import { isActiveAssetStatus } from '@/lib/assetStatuses';
import type {
  KpiAssetMetrics,
  KpiChartType,
  KpiDataContext,
  KpiFilterFieldKey,
  KpiGroupBy,
  KpiMetric,
  KpiQuickData,
  KpiQuickType,
  KpiTotals,
  KpiWidget,
} from '@/lib/kpiWidgets';
import {
  applyKpiWidgetFilters,
  computeKpiWidgetData,
  suggestKpiWidgetSize,
} from '@/lib/kpiWidgets';

export type HomeFilterFieldKey =
  | 'dateFrom' | 'dateTo' | 'departmentId' | 'locationId' | 'groupId' | 'templateId'
  | 'vendorId' | 'status' | 'category' | 'purchaseYear' | 'warrantyStatus' | 'condition' | 'assignedUserId';

export type HomeWidgetFilters = Partial<Record<HomeFilterFieldKey, string>>;

export type HomeWidgetKind =
  | 'kpi'
  | 'attention'
  | 'activity'
  | 'chart'
  | 'warranty_overview'
  | 'notifications'
  | 'financial'
  | 'latest_assets'
  | 'performance'
  | 'system_status'
  | 'metric'
  | 'quick';

export type HomeKpiMetric =
  | 'total_assets'
  | 'active_assets'
  | 'under_maintenance'
  | 'warranty_expiring'
  | 'replacement_required';

export type HomeChartMetric = 'by_group' | 'by_status' | 'by_location';

export type HomeWidgetSize = 'small' | 'medium' | 'large' | 'full';

export type HomeWidget = {
  id: string;
  title: string;
  kind: HomeWidgetKind;
  metric?: HomeKpiMetric | HomeChartMetric | KpiMetric;
  groupBy?: KpiGroupBy;
  chartType?: KpiChartType | 'donut' | 'horizontal_bar';
  quickType?: KpiQuickType;
  timeRange?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  size: HomeWidgetSize;
  filters: HomeWidgetFilters;
  filterFields: HomeFilterFieldKey[];
  order: number;
  visible?: boolean;
  sizeLocked?: boolean;
  colSpan?: number;
  rowSpan?: number;
};

export type HomeDashboardLayout = { version: number; widgets: HomeWidget[] };

export type HomeDashboard = {
  _id: string;
  name: string;
  description?: string;
  scope: 'personal' | 'organization';
  ownerId?: string;
  templateId?: string | null;
  allowedRoleIds?: string[];
  autoRefresh: 'manual' | '1m' | '5m' | '15m';
  theme: 'comfortable' | 'compact';
  layout: HomeDashboardLayout;
  updatedAt?: string;
};

export type HomeTotals = {
  totalAssets: number;
  activeAssets: number;
  underMaintenance: number;
  warrantyExpiring30: number;
  replacementRequired: number;
  unassigned: number;
  lowHealth: number;
};

export type HomeAttentionItem = {
  key: string;
  icon: string;
  label: string;
  count: number;
  href: string;
};

export type HomeActivityItem = {
  type: string;
  label: string;
  description: string;
  at: string;
  userName?: string;
};

export type HomeDataContext = {
  assets: KpiAssetMetrics[];
  totals: HomeTotals;
  attention: HomeAttentionItem[];
  activity: HomeActivityItem[];
  warranty: { active: number; expiring: number; expired: number };
  financial: { enabled: boolean; purchaseValue: number; bookValue: number; depreciation: number };
  performance: { avgResolutionHours: number; utilizationPct: number; avgHealthScore: number };
  notifications: Array<{ type: string; message: string; href: string }>;
  distributions: {
    byGroup: { label: string; value: number }[];
    byStatus: { label: string; value: number }[];
    byLocation: { label: string; value: number }[];
  };
  latestAssets: Array<{
    id: string;
    name: string;
    assetIdString: string;
    status: string;
    category: string;
    createdAt: string;
  }>;
  system: {
    tier: string;
    plan: string;
    daysRemaining: number | null;
    isExpired: boolean;
    assetCount: number;
    assetLimit: number;
    userCount: number;
    userLimit: number;
  };
  depreciationEnabled: boolean;
  kpiTotals: KpiTotals;
  quick: KpiQuickData;
};

export type HomeWidgetResult = {
  kpiValue?: string;
  kpiHint?: string;
  attentionItems?: HomeAttentionItem[];
  activityItems?: HomeActivityItem[];
  points?: { label: string; value: number; color?: string; hint?: string }[];
  tableRows?: { label: string; value: string }[];
  listRows?: { primary: string; secondary?: string; meta?: string }[];
  gaugeValue?: number;
  gaugeMax?: number;
  warranty?: { active: number; expiring: number; expired: number };
  financial?: { enabled: boolean; purchaseValue: number; bookValue: number; depreciation: number };
  notifications?: Array<{ type: string; message: string; href: string }>;
  latestAssets?: HomeDataContext['latestAssets'];
  performance?: HomeDataContext['performance'];
  system?: HomeDataContext['system'];
};

export const HOME_GRID_COLS = 12;
export const HOME_MIN_COL_SPAN = 3;
export const HOME_MAX_COL_SPAN = 12;
export const HOME_MIN_ROW_SPAN = 1;
export const HOME_MAX_ROW_SPAN = 6;
export const HOME_ROW_HEIGHT_PX = 72;

export const HOME_SIZE_CYCLE: HomeWidgetSize[] = ['small', 'medium', 'large', 'full'];

export const HOME_SIZE_SPANS: Record<HomeWidgetSize, { colSpan: number; rowSpan: number }> = {
  small: { colSpan: 3, rowSpan: 1 },
  medium: { colSpan: 6, rowSpan: 2 },
  large: { colSpan: 9, rowSpan: 3 },
  full: { colSpan: 12, rowSpan: 3 },
};

export const WIDGET_FILTER_CATALOG: { key: HomeFilterFieldKey; label: string }[] = [
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

export const WIDGET_KIND_OPTIONS: { id: HomeWidgetKind; label: string }[] = [
  { id: 'kpi', label: 'KPI card' },
  { id: 'attention', label: 'Attention required' },
  { id: 'activity', label: 'Recent activity' },
  { id: 'chart', label: 'Chart' },
  { id: 'warranty_overview', label: 'Warranty overview' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'financial', label: 'Financial snapshot' },
  { id: 'latest_assets', label: 'Latest assets' },
  { id: 'performance', label: 'Performance' },
  { id: 'system_status', label: 'System status' },
];

export const KPI_METRIC_OPTIONS: { id: HomeKpiMetric; label: string }[] = [
  { id: 'total_assets', label: 'Total assets' },
  { id: 'active_assets', label: 'Active assets' },
  { id: 'under_maintenance', label: 'Under maintenance' },
  { id: 'warranty_expiring', label: 'Warranty expiring' },
  { id: 'replacement_required', label: 'Needs replacement' },
];

export const CHART_METRIC_OPTIONS: { id: HomeChartMetric; label: string }[] = [
  { id: 'by_group', label: 'By group' },
  { id: 'by_status', label: 'By status' },
  { id: 'by_location', label: 'By location' },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#84cc16', '#ec4899'];

function colorAt(i: number) {
  return COLORS[i % COLORS.length];
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function clampHomeSpan(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function bucketCount(assets: KpiAssetMetrics[], keyFn: (a: KpiAssetMetrics) => string) {
  const map = new Map<string, number>();
  for (const a of assets) {
    const key = keyFn(a);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function computeTotalsFromAssets(assets: KpiAssetMetrics[]): HomeTotals {
  return {
    totalAssets: assets.length,
    activeAssets: assets.filter((a) => isActiveAssetStatus(a.status)).length,
    underMaintenance: assets.filter((a) => ['under_maintenance', 'needs_repair'].includes(a.status || '')).length,
    warrantyExpiring30: assets.filter((a) => a.warrantyStatus === 'expiring').length,
    replacementRequired: assets.filter((a) => a.replacementScore >= 75).length,
    unassigned: assets.filter((a) => !a.isAssigned).length,
    lowHealth: assets.filter((a) => a.healthScore < 50).length,
  };
}

function computeWarrantyFromAssets(assets: KpiAssetMetrics[]) {
  return {
    active: assets.filter((a) => a.warrantyStatus === 'active').length,
    expiring: assets.filter((a) => a.warrantyStatus === 'expiring').length,
    expired: assets.filter((a) => a.warrantyStatus === 'expired').length,
  };
}

function computeFinancialFromAssets(assets: KpiAssetMetrics[], enabled: boolean) {
  return {
    enabled,
    purchaseValue: assets.reduce((s, a) => s + a.purchaseValue, 0),
    bookValue: assets.reduce((s, a) => s + a.currentValue, 0),
    depreciation: assets.reduce((s, a) => s + a.depreciation, 0),
  };
}

function computePerformanceFromAssets(assets: KpiAssetMetrics[], ctx: HomeDataContext) {
  return {
    avgResolutionHours: ctx.performance.avgResolutionHours,
    utilizationPct: assets.length
      ? Math.round((assets.filter((a) => a.isAssigned).length / assets.length) * 1000) / 10
      : 0,
    avgHealthScore: assets.length
      ? Math.round(assets.reduce((s, a) => s + a.healthScore, 0) / assets.length)
      : 0,
  };
}

function computeAttentionFromTotals(totals: HomeTotals): HomeAttentionItem[] {
  return [
    { key: 'warranty_expiring', icon: '📅', label: 'Warranties expiring soon', count: totals.warrantyExpiring30, href: '/dashboard/assets' },
    { key: 'unassigned', icon: '📍', label: 'Unassigned assets', count: totals.unassigned, href: '/dashboard/assets' },
    { key: 'low_health', icon: '⚠️', label: 'Low health assets', count: totals.lowHealth, href: '/dashboard/asset-health' },
    { key: 'under_maintenance', icon: '🔧', label: 'Under maintenance', count: totals.underMaintenance, href: '/dashboard/maintenance' },
  ].filter((i) => i.count > 0);
}

function kpiValueFromMetric(metric: HomeKpiMetric, totals: HomeTotals): string {
  switch (metric) {
    case 'total_assets': return String(totals.totalAssets);
    case 'active_assets': return String(totals.activeAssets);
    case 'under_maintenance': return String(totals.underMaintenance);
    case 'warranty_expiring': return String(totals.warrantyExpiring30);
    case 'replacement_required': return String(totals.replacementRequired);
    default: return '—';
  }
}

export function isCustomHomeWidget(widget: HomeWidget) {
  return widget.kind === 'metric' || widget.kind === 'quick';
}

export function homeDataAsKpiContext(ctx: HomeDataContext): KpiDataContext {
  return {
    assets: ctx.assets,
    totals: ctx.kpiTotals ?? {
      totalAssets: ctx.totals?.totalAssets ?? ctx.assets.length,
      activeAssets: ctx.totals?.activeAssets ?? 0,
      assetsAddedThisMonth: 0,
      assetsRetired: 0,
      utilizationPct: ctx.performance?.utilizationPct ?? 0,
      averageAssetAge: 0,
      totalPurchaseValue: ctx.financial?.purchaseValue ?? 0,
      currentBookValue: ctx.financial?.bookValue ?? 0,
      totalDepreciation: ctx.financial?.depreciation ?? 0,
      replacementValue: 0,
      averageAssetCost: 0,
      warrantyActive: ctx.warranty?.active ?? 0,
      warrantyExpiring: ctx.warranty?.expiring ?? 0,
      warrantyExpired: ctx.warranty?.expired ?? 0,
    },
    quick: ctx.quick ?? {
      latestIssues: [],
      recentAssets: [],
      upcomingMaintenance: [],
      warrantyExpiringSoon: [],
      recentMovements: [],
      recentAuditLogs: [],
      recentlyAddedAssets: [],
      topVendors: [],
      lowHealthAssets: [],
      replacementRecommendations: [],
    },
  };
}

export function homeWidgetAsKpi(widget: HomeWidget): KpiWidget {
  return {
    id: widget.id,
    title: widget.title,
    kind: widget.kind as 'metric' | 'quick',
    metric: widget.metric as KpiMetric | undefined,
    groupBy: widget.groupBy,
    chartType: (widget.chartType as KpiChartType) || 'bar',
    quickType: widget.quickType,
    filters: widget.filters,
    filterFields: widget.filterFields as KpiFilterFieldKey[],
    timeRange: widget.timeRange,
    sortOrder: widget.sortOrder,
    limit: widget.limit,
    order: widget.order,
    colSpan: widget.colSpan,
    rowSpan: widget.rowSpan,
    sizeLocked: widget.sizeLocked,
  };
}

export function getHomeWidgetSizing(ctx: HomeDataContext, widget: HomeWidget): { colSpan: number; rowSpan: number } {
  if (isCustomHomeWidget(widget)) {
    const kpiWidget = homeWidgetAsKpi(widget);
    const result = computeKpiWidgetData(homeDataAsKpiContext(ctx), kpiWidget);
    return suggestKpiWidgetSize(kpiWidget, result);
  }
  const result = buildHomeWidgetResult(ctx, widget);
  return suggestHomeWidgetSize(widget, result);
}

export function buildHomeWidgetResult(ctx: HomeDataContext, widget: HomeWidget): HomeWidgetResult {
  if (isCustomHomeWidget(widget)) {
    const kpiResult = computeKpiWidgetData(homeDataAsKpiContext(ctx), homeWidgetAsKpi(widget));
    return {
      kpiValue: kpiResult.kpiValue,
      kpiHint: kpiResult.kpiHint,
      points: kpiResult.points,
      gaugeValue: kpiResult.gaugeValue,
      gaugeMax: kpiResult.gaugeMax,
      listRows: kpiResult.listRows,
      tableRows: kpiResult.tableRows,
    };
  }

  const filtered = applyKpiWidgetFilters(ctx.assets, widget.filters);
  const totals = computeTotalsFromAssets(filtered);
  const assetIds = new Set(filtered.map((a) => a.assetId));

  switch (widget.kind) {
    case 'kpi': {
      const metric = (widget.metric as HomeKpiMetric) || 'total_assets';
      return { kpiValue: kpiValueFromMetric(metric, totals) };
    }
    case 'attention': {
      const hasWidgetFilters = Object.values(widget.filters ?? {}).some((v) => v);
      return {
        attentionItems: hasWidgetFilters ? computeAttentionFromTotals(totals) : ctx.attention,
      };
    }
    case 'activity':
      return {
        activityItems: ctx.activity.slice(0, 20).map((a) => ({
          ...a,
          description: a.description || a.label,
        })),
      };
    case 'chart': {
      const metric = (widget.metric as HomeChartMetric) || 'by_group';
      let points: { label: string; value: number }[] = [];
      if (metric === 'by_group') {
        points = bucketCount(filtered, (a) => a.groupName || 'Ungrouped');
      } else if (metric === 'by_status') {
        points = bucketCount(filtered, (a) => (a.status || 'unknown').replace(/_/g, ' '));
      } else {
        points = bucketCount(filtered, (a) => a.location || 'Unassigned');
      }
      return {
        points: points.slice(0, 12).map((p, i) => ({ ...p, color: colorAt(i), hint: `${p.value} assets` })),
      };
    }
    case 'warranty_overview':
      return { warranty: computeWarrantyFromAssets(filtered) };
    case 'financial':
      return { financial: computeFinancialFromAssets(filtered, ctx.financial.enabled) };
    case 'notifications':
      return { notifications: ctx.notifications };
    case 'latest_assets':
      return {
        latestAssets: ctx.latestAssets.filter((a) => assetIds.has(a.id)).slice(0, 10),
      };
    case 'performance':
      return { performance: computePerformanceFromAssets(filtered, ctx) };
    case 'system_status':
      return { system: ctx.system };
    default:
      return {};
  }
}

export function nextHomeWidgetSize(current: HomeWidgetSize): HomeWidgetSize {
  const idx = HOME_SIZE_CYCLE.indexOf(current);
  return HOME_SIZE_CYCLE[(idx + 1) % HOME_SIZE_CYCLE.length];
}

export function sizeToSpans(size: HomeWidgetSize) {
  return HOME_SIZE_SPANS[size] || HOME_SIZE_SPANS.medium;
}

export function newHomeWidget(partial?: Partial<HomeWidget>): HomeWidget {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hw-${Date.now()}`;
  return {
    id,
    title: 'New widget',
    kind: 'metric',
    metric: 'asset_count',
    groupBy: 'category',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 10,
    size: 'medium',
    filters: {},
    filterFields: [],
    order: 0,
    visible: true,
    sizeLocked: false,
    colSpan: 6,
    rowSpan: 2,
    ...partial,
  };
}

export function reorderHomeWidgets(widgets: HomeWidget[], fromId: string, toId: string): HomeWidget[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const fromIdx = sorted.findIndex((w) => w.id === fromId);
  const toIdx = sorted.findIndex((w) => w.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return sorted;
  const [moved] = sorted.splice(fromIdx, 1);
  sorted.splice(toIdx, 0, moved);
  return sorted.map((w, i) => ({ ...w, order: i }));
}

export function suggestHomeWidgetSize(widget: HomeWidget, result: HomeWidgetResult): { colSpan: number; rowSpan: number } {
  if (widget.sizeLocked && widget.colSpan && widget.rowSpan) {
    return { colSpan: widget.colSpan, rowSpan: widget.rowSpan };
  }

  if (widget.kind === 'kpi') {
    return { colSpan: 3, rowSpan: 1 + (widget.filterFields?.length ? 1 : 0) };
  }
  if (widget.kind === 'metric' || widget.kind === 'quick') {
    return { colSpan: 6, rowSpan: 2 };
  }
  if (widget.kind === 'attention' || widget.kind === 'activity') {
    const count = result.attentionItems?.length || result.activityItems?.length || 0;
    return {
      colSpan: 6,
      rowSpan: clampHomeSpan(2 + Math.ceil(count / 3), HOME_MIN_ROW_SPAN, HOME_MAX_ROW_SPAN),
    };
  }
  if (widget.kind === 'chart') {
    const n = result.points?.length || 0;
    return {
      colSpan: 6,
      rowSpan: clampHomeSpan(2 + Math.ceil(n / 4), HOME_MIN_ROW_SPAN, HOME_MAX_ROW_SPAN),
    };
  }
  if (widget.kind === 'latest_assets' || widget.kind === 'notifications') {
    return { colSpan: 6, rowSpan: 3 };
  }
  if (widget.kind === 'system_status' || widget.kind === 'financial' || widget.kind === 'warranty_overview' || widget.kind === 'performance') {
    return { colSpan: 6, rowSpan: 2 };
  }
  return { colSpan: 6, rowSpan: 2 };
}

export function mergeHomeLayout(incoming: Partial<HomeDashboardLayout> | null | undefined): HomeDashboardLayout {
  if (!incoming?.widgets?.length) {
    return { version: 1, widgets: [] };
  }
  return {
    version: incoming.version ?? 1,
    widgets: [...incoming.widgets]
      .sort((a, b) => a.order - b.order)
      .map((w) => {
        const size = w.size || 'medium';
        const spans = sizeToSpans(size);
        return {
          ...w,
          size,
          filterFields: w.filterFields ?? [],
          filters: w.filters ?? {},
          colSpan: w.colSpan ?? spans.colSpan,
          rowSpan: w.rowSpan ?? spans.rowSpan,
          sizeLocked: w.sizeLocked ?? false,
          visible: w.visible ?? true,
        };
      }),
  };
}

export { formatINR };
