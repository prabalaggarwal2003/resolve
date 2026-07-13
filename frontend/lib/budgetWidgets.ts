import { isDateInRange, mergeWidgetTimeRange } from './budgetModuleFilters';

export type BudgetRow = {
  id: string;
  name: string;
  code?: string;
  status: string;
  statusLabel: string;
  budgetTypeId: string;
  budgetTypeLabel: string;
  financialYear: string;
  currency: string;
  budgetOwnerId?: string | null;
  budgetOwnerName: string;
  departmentId: string;
  departmentLabel: string;
  locationId: string;
  locationLabel: string;
  fundingSourceId: string;
  fundingSourceLabel: string;
  project: string;
  costCenter: string;
  category: string;
  allocatedAmount: number;
  plannedAmount: number;
  committedAmount: number;
  actualSpend: number;
  remainingAmount: number;
  availableBalance: number;
  utilizationPct: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  startDate?: string;
  endDate?: string;
};

export type ProcurementRow = {
  id: string;
  purchaseId: string;
  budgetId?: string | null;
  budgetName: string;
  vendorId?: string | null;
  vendorLabel: string;
  totalCost: number;
  lifecycleStage: string;
  paymentStatus: string;
  purchaseDate?: string;
  month: string;
  quarter: string;
  fundingSourceLabel: string;
  project: string;
  costCenter: string;
};

export type MonthlySpendRow = {
  month: string;
  planned: number;
  actual: number;
  committed: number;
  forecast?: boolean;
};

export type SpendForecast = {
  trendDirection: 'up' | 'down' | 'flat';
  monthlySlope: number;
  projectedNextMonth: number;
  projectedQuarterSpend: number;
  forecastMonths: MonthlySpendRow[];
};

export type BudgetTotals = {
  budgetCount: number;
  activeBudgets: number;
  totalAllocated: number;
  totalPlanned: number;
  totalCommitted: number;
  totalActual: number;
  totalRemaining: number;
  utilizationPct: number;
  budgetsNearLimit: number;
  budgetsExceeded: number;
  pendingPurchaseRequests: number;
};

export type BudgetQuickData = {
  budgetsNearLimit: Array<{ id: string; name: string; utilizationPct: number; remainingAmount: number; status: string }>;
  pendingProcurements: Array<{ id: string; purchaseId: string; totalCost: number; vendorLabel: string; lifecycleStage: string }>;
  topDepartments: Array<{ label: string; value: number }>;
};

export type BudgetMetric =
  | 'budget_count' | 'total_allocated' | 'total_planned' | 'total_committed' | 'total_actual'
  | 'total_remaining' | 'available_balance' | 'utilization_pct' | 'avg_utilization'
  | 'over_budget_count' | 'pending_procurement_count'
  | 'allocated' | 'planned' | 'committed' | 'actual' | 'remaining' | 'utilization'
  | 'procurement_amount' | 'planned_vs_actual'
  | 'budget_trend' | 'spend_forecast';

export type BudgetGroupBy =
  | 'department' | 'budget_type' | 'status' | 'financial_year' | 'owner' | 'location'
  | 'funding_source' | 'vendor' | 'project' | 'cost_center' | 'category' | 'month' | 'quarter' | null;

export type BudgetChartType =
  | 'kpi' | 'bar' | 'horizontal_bar' | 'line' | 'area' | 'pie' | 'donut'
  | 'stacked_bar' | 'table' | 'progress_ring' | 'gauge';

export type BudgetQuickType = 'budgets_near_limit' | 'pending_procurements' | 'top_departments';

export type BudgetFilterFieldKey =
  | 'dateFrom' | 'dateTo' | 'financialYear' | 'status' | 'budgetTypeId'
  | 'departmentId' | 'locationId' | 'fundingSourceId' | 'budgetOwnerId';

export type BudgetWidgetFilters = Partial<Record<BudgetFilterFieldKey, string>>;

export type BudgetWidget = {
  id: string;
  title: string;
  kind: 'metric' | 'quick';
  metric?: BudgetMetric;
  groupBy?: BudgetGroupBy;
  chartType?: BudgetChartType;
  quickType?: BudgetQuickType;
  filters: BudgetWidgetFilters;
  filterFields: BudgetFilterFieldKey[];
  timeRange?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  order: number;
  colSpan?: number;
  rowSpan?: number;
  sizeLocked?: boolean;
  hidden?: boolean;
};

export type BudgetDashboardLayout = { version: number; widgets: BudgetWidget[] };

export type BudgetDashboard = {
  _id: string;
  name: string;
  description?: string;
  scope: 'personal' | 'organization';
  ownerId?: string;
  templateId?: string | null;
  allowedRoleIds?: string[];
  autoRefresh: 'manual' | '1m' | '5m' | '15m';
  layout: BudgetDashboardLayout;
  updatedAt?: string;
};

export type BudgetDataContext = {
  budgets: BudgetRow[];
  procurements: ProcurementRow[];
  monthlySpend: MonthlySpendRow[];
  monthlySpendWithForecast?: MonthlySpendRow[];
  quarterlySpend?: MonthlySpendRow[];
  forecast?: SpendForecast;
  totals: BudgetTotals;
  quick: BudgetQuickData;
};

export type BudgetWidgetResult = {
  kpiValue?: string;
  kpiHint?: string;
  points: { label: string; value: number; color?: string; hint?: string; stack?: Record<string, number> }[];
  tableRows?: { label: string; value: string }[];
  listRows?: { primary: string; secondary?: string; meta?: string }[];
  gaugeValue?: number;
  gaugeMax?: number;
};

export const BUDGET_GRID_COLS = 12;
export const BUDGET_MIN_COL_SPAN = 3;
export const BUDGET_MAX_COL_SPAN = 12;
export const BUDGET_MIN_ROW_SPAN = 1;
export const BUDGET_MAX_ROW_SPAN = 6;
export const BUDGET_ROW_HEIGHT_PX = 72;

export const METRIC_OPTIONS: { id: BudgetMetric; label: string; category: string }[] = [
  { id: 'total_allocated', label: 'Total Budget', category: 'Summary' },
  { id: 'total_actual', label: 'Total Spend', category: 'Summary' },
  { id: 'total_remaining', label: 'Remaining Budget', category: 'Summary' },
  { id: 'utilization_pct', label: 'Budget Utilization %', category: 'Summary' },
  { id: 'budget_count', label: 'Budget Count', category: 'Summary' },
  { id: 'pending_procurement_count', label: 'Pending Purchases', category: 'Summary' },
  { id: 'allocated', label: 'Allocated Amount', category: 'Budget' },
  { id: 'planned', label: 'Planned Amount', category: 'Budget' },
  { id: 'committed', label: 'Committed Amount', category: 'Budget' },
  { id: 'actual', label: 'Actual Spend', category: 'Budget' },
  { id: 'remaining', label: 'Remaining', category: 'Budget' },
  { id: 'utilization', label: 'Utilization %', category: 'Budget' },
  { id: 'procurement_amount', label: 'Procurement Amount', category: 'Procurement' },
  { id: 'planned_vs_actual', label: 'Planned vs Actual', category: 'Trend' },
  { id: 'budget_trend', label: 'Budget Spend Trend', category: 'Trend' },
  { id: 'spend_forecast', label: 'Spend Forecast (next month)', category: 'Trend' },
];

export const GROUP_BY_OPTIONS: { id: NonNullable<BudgetGroupBy>; label: string }[] = [
  { id: 'department', label: 'Department' },
  { id: 'budget_type', label: 'Budget Type' },
  { id: 'status', label: 'Status' },
  { id: 'financial_year', label: 'Financial Year' },
  { id: 'owner', label: 'Budget Owner' },
  { id: 'location', label: 'Location' },
  { id: 'funding_source', label: 'Funding Source' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'project', label: 'Project' },
  { id: 'cost_center', label: 'Cost Center' },
  { id: 'category', label: 'Category' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
];

export const CHART_TYPE_OPTIONS: { id: BudgetChartType; label: string; needsGroupBy?: boolean }[] = [
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

export const QUICK_WIDGET_OPTIONS: { id: BudgetQuickType; label: string }[] = [
  { id: 'budgets_near_limit', label: 'Budgets Near Limit' },
  { id: 'pending_procurements', label: 'Pending Purchases' },
  { id: 'top_departments', label: 'Top Spending Departments' },
];

export const WIDGET_FILTER_CATALOG: { key: BudgetFilterFieldKey; label: string }[] = [
  { key: 'dateFrom', label: 'Date from' },
  { key: 'dateTo', label: 'Date to' },
  { key: 'financialYear', label: 'Financial year' },
  { key: 'status', label: 'Status' },
  { key: 'budgetTypeId', label: 'Budget type' },
  { key: 'departmentId', label: 'Department' },
  { key: 'locationId', label: 'Location' },
  { key: 'fundingSourceId', label: 'Funding source' },
  { key: 'budgetOwnerId', label: 'Budget owner' },
];

export const WIDGET_LIBRARY: { category: string; items: { title: string; widget: Partial<BudgetWidget> }[] }[] = [
  {
    category: 'Summary',
    items: [
      { title: 'Total Budget', widget: { kind: 'metric', metric: 'total_allocated', chartType: 'kpi' } },
      { title: 'Total Spend', widget: { kind: 'metric', metric: 'total_actual', chartType: 'kpi' } },
      { title: 'Utilization', widget: { kind: 'metric', metric: 'utilization_pct', chartType: 'gauge' } },
    ],
  },
  {
    category: 'Allocation',
    items: [
      { title: 'By Department', widget: { kind: 'metric', metric: 'allocated', groupBy: 'department', chartType: 'horizontal_bar' } },
      { title: 'By Funding Source', widget: { kind: 'metric', metric: 'allocated', groupBy: 'funding_source', chartType: 'donut' } },
      { title: 'By Budget Type', widget: { kind: 'metric', metric: 'allocated', groupBy: 'budget_type', chartType: 'donut' } },
    ],
  },
  {
    category: 'Spending',
    items: [
      { title: 'Planned vs Actual', widget: { kind: 'metric', metric: 'planned_vs_actual', groupBy: 'month', chartType: 'stacked_bar' } },
      { title: 'Vendor Spending', widget: { kind: 'metric', metric: 'procurement_amount', groupBy: 'vendor', chartType: 'bar' } },
      { title: 'Monthly Trend', widget: { kind: 'metric', metric: 'actual', groupBy: 'month', chartType: 'line' } },
      { title: 'Spend Forecast', widget: { kind: 'metric', metric: 'budget_trend', groupBy: 'month', chartType: 'line', timeRange: '1y' } },
      { title: 'Next Month Forecast', widget: { kind: 'metric', metric: 'spend_forecast', chartType: 'kpi' } },
    ],
  },
  {
    category: 'Lists',
    items: [
      { title: 'Near Limit', widget: { kind: 'quick', quickType: 'budgets_near_limit' } },
      { title: 'Pending Purchases', widget: { kind: 'quick', quickType: 'pending_procurements' } },
    ],
  },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#84cc16', '#ec4899'];

function monthInRange(monthKey: string, filters: BudgetWidgetFilters): boolean {
  if (!filters.dateFrom && !filters.dateTo) return true;
  const d = new Date(`${monthKey}-01`);
  if (filters.dateFrom && d < new Date(filters.dateFrom)) return false;
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }
  return true;
}

function rebuildMonthlySpend(procurements: ProcurementRow[]): MonthlySpendRow[] {
  const monthlyMap: Record<string, MonthlySpendRow> = {};
  for (const p of procurements) {
    const key = p.month;
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, planned: 0, actual: 0, committed: 0 };
    monthlyMap[key].planned += p.totalCost;
    if (['approved', 'ordered'].includes(p.lifecycleStage)) monthlyMap[key].committed += p.totalCost;
    if (['received', 'assets_created'].includes(p.lifecycleStage)) monthlyMap[key].actual += p.totalCost;
  }
  return Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
}

function colorAt(i: number) {
  return COLORS[i % COLORS.length];
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function clampBudgetSpan(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function mergeBudgetLayout(layout?: Partial<BudgetDashboardLayout> | null): BudgetDashboardLayout {
  const widgets = (layout?.widgets || []).map((w, i) => ({
    ...w,
    id: w.id || crypto.randomUUID(),
    filters: w.filters ?? {},
    filterFields: w.filterFields ?? [],
    order: w.order ?? i,
    colSpan: w.colSpan ?? 3,
    rowSpan: w.rowSpan ?? 2,
  }));
  return { version: layout?.version ?? 1, widgets };
}

export function newBudgetWidget(partial: Partial<BudgetWidget> & { order: number }): BudgetWidget {
  return {
    id: partial.id || crypto.randomUUID(),
    title: partial.title || 'New widget',
    kind: partial.kind || 'metric',
    metric: partial.metric || 'total_allocated',
    groupBy: partial.groupBy ?? null,
    chartType: partial.chartType || 'kpi',
    quickType: partial.quickType,
    filters: partial.filters ?? {},
    filterFields: partial.filterFields ?? [],
    timeRange: partial.timeRange,
    sortOrder: partial.sortOrder ?? 'desc',
    limit: partial.limit ?? 10,
    order: partial.order,
    colSpan: partial.colSpan ?? 3,
    rowSpan: partial.rowSpan ?? 2,
    sizeLocked: partial.sizeLocked ?? false,
    hidden: partial.hidden ?? false,
  };
}

export function reorderBudgetWidgets(widgets: BudgetWidget[], dragId: string, targetId: string) {
  const from = widgets.findIndex((w) => w.id === dragId);
  const to = widgets.findIndex((w) => w.id === targetId);
  if (from < 0 || to < 0) return widgets;
  const next = [...widgets];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((w, i) => ({ ...w, order: i }));
}

function eqId(a?: string | null, b?: string) {
  if (!b) return true;
  if (!a) return false;
  return String(a) === String(b);
}

export function applyBudgetWidgetFilters(ctx: BudgetDataContext, filters?: BudgetWidgetFilters, timeRange?: string) {
  const f = mergeWidgetTimeRange(filters ?? {}, timeRange);
  const budgets = ctx.budgets.filter((b) => {
    if (f.status && b.status !== f.status) return false;
    if (f.budgetTypeId && b.budgetTypeId !== f.budgetTypeId) return false;
    if (f.financialYear && b.financialYear !== f.financialYear) return false;
    if (!eqId(b.budgetOwnerId, f.budgetOwnerId)) return false;
    if (!eqId(b.departmentId, f.departmentId)) return false;
    if (!eqId(b.locationId, f.locationId)) return false;
    if (f.fundingSourceId && b.fundingSourceId !== f.fundingSourceId) return false;
    if (f.dateFrom && b.startDate && new Date(b.startDate) < new Date(f.dateFrom)) return false;
    if (f.dateTo && b.endDate) {
      const end = new Date(f.dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(b.endDate) > end) return false;
    }
    return true;
  });
  const budgetIds = new Set(budgets.map((b) => b.id));
  const procurements = ctx.procurements.filter((p) => {
    if (p.budgetId && !budgetIds.has(p.budgetId)) return false;
    if (!isDateInRange(p.purchaseDate, f)) return false;
    return true;
  });
  const monthlySpend = rebuildMonthlySpend(procurements).filter((m) => monthInRange(m.month, f));
  const totals = {
    ...ctx.totals,
    budgetCount: budgets.length,
    activeBudgets: budgets.filter((b) => b.status === 'active').length,
    totalAllocated: budgets.reduce((s, b) => s + b.allocatedAmount, 0),
    totalPlanned: budgets.reduce((s, b) => s + b.plannedAmount, 0),
    totalCommitted: budgets.reduce((s, b) => s + b.committedAmount, 0),
    totalActual: budgets.reduce((s, b) => s + b.actualSpend, 0),
    totalRemaining: budgets.reduce((s, b) => s + b.remainingAmount, 0),
    utilizationPct: 0,
    budgetsNearLimit: budgets.filter((b) => b.isNearLimit).length,
    budgetsExceeded: budgets.filter((b) => b.isOverBudget).length,
  };
  totals.utilizationPct = totals.totalAllocated > 0
    ? Math.round((totals.totalActual / totals.totalAllocated) * 1000) / 10
    : 0;
  return {
    ...ctx,
    budgets,
    procurements,
    monthlySpend,
    monthlySpendWithForecast: ctx.monthlySpendWithForecast,
    forecast: ctx.forecast,
    totals,
  };
}

function budgetGroupKey(b: BudgetRow, groupBy: BudgetGroupBy): string {
  switch (groupBy) {
    case 'department': return b.departmentLabel;
    case 'budget_type': return b.budgetTypeLabel;
    case 'status': return b.statusLabel;
    case 'financial_year': return b.financialYear || 'Unknown';
    case 'owner': return b.budgetOwnerName || 'Unassigned';
    case 'location': return b.locationLabel;
    case 'funding_source': return b.fundingSourceLabel;
    case 'project': return b.project || 'Unassigned';
    case 'cost_center': return b.costCenter || 'Unassigned';
    case 'category': return b.category || 'Uncategorized';
    default: return 'All';
  }
}

function budgetMetricValue(b: BudgetRow, metric: BudgetMetric): number {
  switch (metric) {
    case 'allocated': return b.allocatedAmount;
    case 'planned': return b.plannedAmount;
    case 'committed': return b.committedAmount;
    case 'actual': return b.actualSpend;
    case 'remaining': return b.remainingAmount;
    case 'utilization': return b.utilizationPct;
    default: return 0;
  }
}

function aggregateFromTotals(totals: BudgetTotals, budgets: BudgetRow[], metric: BudgetMetric): number {
  switch (metric) {
    case 'budget_count': return totals.budgetCount;
    case 'total_allocated': return totals.totalAllocated;
    case 'total_planned': return totals.totalPlanned;
    case 'total_committed': return totals.totalCommitted;
    case 'total_actual': return totals.totalActual;
    case 'total_remaining': return totals.totalRemaining;
    case 'utilization_pct': return totals.utilizationPct;
    case 'pending_procurement_count': return totals.pendingPurchaseRequests;
    case 'over_budget_count': return totals.budgetsExceeded;
    case 'avg_utilization':
      return budgets.length
        ? Math.round(budgets.reduce((s, b) => s + b.utilizationPct, 0) / budgets.length * 10) / 10
        : 0;
    case 'available_balance':
      return budgets.reduce((s, b) => s + b.availableBalance, 0);
    default: return 0;
  }
}

export function formatBudgetMetric(metric: BudgetMetric, value: number): string {
  if ([
    'total_allocated', 'total_planned', 'total_committed', 'total_actual', 'total_remaining',
    'allocated', 'planned', 'committed', 'actual', 'remaining', 'available_balance', 'procurement_amount',
  ].includes(metric)) {
    return formatINR(value);
  }
  if (metric === 'utilization_pct' || metric === 'utilization' || metric === 'avg_utilization') return `${value}%`;
  return String(Math.round(value));
}

export function computeBudgetWidgetData(ctx: BudgetDataContext, widget: BudgetWidget): BudgetWidgetResult {
  const filtered = applyBudgetWidgetFilters(ctx, widget.filters, widget.timeRange);

  if (widget.kind === 'quick' && widget.quickType) {
    const limit = widget.limit || 8;
    switch (widget.quickType) {
      case 'budgets_near_limit':
        return {
          points: [],
          listRows: filtered.quick.budgetsNearLimit.slice(0, limit).map((b) => ({
            primary: b.name,
            secondary: `${b.utilizationPct}% utilized`,
            meta: formatINR(b.remainingAmount),
          })),
        };
      case 'pending_procurements':
        return {
          points: [],
          listRows: filtered.quick.pendingProcurements.slice(0, limit).map((p) => ({
            primary: p.purchaseId,
            secondary: p.vendorLabel,
            meta: formatINR(p.totalCost),
          })),
        };
      case 'top_departments':
        return {
          points: [],
          listRows: filtered.quick.topDepartments.slice(0, limit).map((d) => ({
            primary: d.label,
            meta: formatINR(d.value),
          })),
        };
      default:
        return { points: [] };
    }
  }

  const metric = widget.metric || 'total_allocated';
  const chartType = widget.chartType || 'kpi';

  if (metric === 'spend_forecast') {
    const projected = filtered.forecast?.projectedNextMonth ?? 0;
    const trend = filtered.forecast?.trendDirection ?? 'flat';
    const hint = trend === 'up' ? 'Trending up' : trend === 'down' ? 'Trending down' : 'Stable';
    return { kpiValue: formatINR(projected), kpiHint: hint, points: [] };
  }

  if (metric === 'budget_trend') {
    const series = [
      ...filtered.monthlySpend.map((m, i) => ({
        label: m.month,
        value: m.actual,
        color: colorAt(i),
        hint: `Actual ${formatINR(m.actual)}`,
      })),
      ...(filtered.forecast?.forecastMonths || []).map((m, i) => ({
        label: `${m.month} (forecast)`,
        value: m.actual,
        color: '#a78bfa',
        hint: `Projected ${formatINR(m.actual)}`,
      })),
    ];
    const limit = widget.limit || 15;
    const points = series.slice(-limit);
    if (chartType === 'table') {
      return { points, tableRows: points.map((p) => ({ label: p.label, value: formatINR(p.value) })) };
    }
    return { points };
  }

  const aggregateMetrics: BudgetMetric[] = [
    'budget_count', 'total_allocated', 'total_planned', 'total_committed', 'total_actual',
    'total_remaining', 'utilization_pct', 'avg_utilization', 'over_budget_count',
    'pending_procurement_count', 'available_balance',
  ];

  if (chartType === 'kpi' || chartType === 'gauge' || chartType === 'progress_ring') {
    const val = aggregateMetrics.includes(metric)
      ? aggregateFromTotals(filtered.totals, filtered.budgets, metric)
      : filtered.budgets.reduce((s, b) => s + budgetMetricValue(b, metric), 0);
    if (chartType === 'gauge' || chartType === 'progress_ring') {
      const max = metric === 'utilization_pct' || metric === 'utilization' ? 100 : Math.max(val * 1.2, 1);
      return { kpiValue: formatBudgetMetric(metric, val), gaugeValue: val, gaugeMax: max, points: [] };
    }
    return { kpiValue: formatBudgetMetric(metric, val), points: [] };
  }

  if (metric === 'planned_vs_actual' && widget.groupBy === 'month') {
    let points = filtered.monthlySpend.map((m, i) => ({
      label: m.month,
      value: m.actual,
      color: colorAt(i),
      stack: { Planned: m.planned, Actual: m.actual },
      hint: `Committed ${formatINR(m.committed)}`,
    }));
    const sortDesc = widget.sortOrder !== 'asc';
    points = points.sort((a, b) => sortDesc ? b.label.localeCompare(a.label) : a.label.localeCompare(b.label));
    points = points.slice(0, widget.limit || 12);
    if (chartType === 'table') {
      return {
        points,
        tableRows: points.map((p) => ({
          label: p.label,
          value: `P ${formatINR(p.stack?.Planned || 0)} / A ${formatINR(p.stack?.Actual || 0)}`,
        })),
      };
    }
    return { points };
  }

  if (metric === 'procurement_amount' || widget.groupBy === 'vendor') {
    const groupBy = widget.groupBy || 'vendor';
    const buckets: Record<string, number> = {};
    for (const p of filtered.procurements) {
      const key = groupBy === 'month' ? p.month : groupBy === 'quarter' ? p.quarter : p.vendorLabel;
      buckets[key] = (buckets[key] || 0) + p.totalCost;
    }
    let points = Object.entries(buckets).map(([label, value], i) => ({
      label,
      value: Math.round(value),
      color: colorAt(i),
    }));
    const sortDesc = widget.sortOrder !== 'asc';
    points = points.sort((a, b) => sortDesc ? b.value - a.value : a.value - b.value).slice(0, widget.limit || 10);
    if (chartType === 'table') {
      return { points, tableRows: points.map((p) => ({ label: p.label, value: formatINR(p.value) })) };
    }
    return { points };
  }

  const groupBy = widget.groupBy || 'department';
  if (groupBy === 'month' || groupBy === 'quarter') {
    const buckets: Record<string, { planned: number; actual: number }> = {};
    for (const m of filtered.monthlySpend) {
      const key = groupBy === 'quarter' ? m.month.replace(/-\d{2}$/, '') : m.month;
      if (!buckets[key]) buckets[key] = { planned: 0, actual: 0 };
      buckets[key].planned += m.planned;
      buckets[key].actual += m.actual;
    }
    let points = Object.entries(buckets).map(([label, v], i) => ({
      label,
      value: v.actual,
      color: colorAt(i),
      stack: { Planned: v.planned, Actual: v.actual },
    }));
    const sortDesc = widget.sortOrder !== 'asc';
    points = points.sort((a, b) => sortDesc ? b.label.localeCompare(a.label) : a.label.localeCompare(b.label));
    points = points.slice(0, widget.limit || 12);
    if (chartType === 'table') {
      return { points, tableRows: points.map((p) => ({ label: p.label, value: formatINR(p.value) })) };
    }
    return { points };
  }

  const buckets: Record<string, { sum: number; count: number }> = {};
  for (const b of filtered.budgets) {
    const key = budgetGroupKey(b, groupBy);
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
    buckets[key].sum += budgetMetricValue(b, metric);
    buckets[key].count += 1;
  }

  let points = Object.entries(buckets).map(([label, b], i) => ({
    label,
    value: metric === 'utilization' && b.count ? Math.round((b.sum / b.count) * 10) / 10 : Math.round(b.sum),
    color: colorAt(i),
    hint: `${b.count} budgets`,
    stack:
      chartType === 'stacked_bar'
        ? { Planned: 0, Actual: 0 }
        : undefined,
  }));

  if (chartType === 'stacked_bar') {
    const stackBuckets: Record<string, { planned: number; actual: number }> = {};
    for (const b of filtered.budgets) {
      const key = budgetGroupKey(b, groupBy);
      if (!stackBuckets[key]) stackBuckets[key] = { planned: 0, actual: 0 };
      stackBuckets[key].planned += b.plannedAmount;
      stackBuckets[key].actual += b.actualSpend;
    }
    points = Object.entries(stackBuckets).map(([label, v], i) => ({
      label,
      value: v.actual,
      color: colorAt(i),
      hint: `P ${formatINR(v.planned)} / A ${formatINR(v.actual)}`,
      stack: { Planned: v.planned, Actual: v.actual },
    }));
  }

  const sortDesc = widget.sortOrder !== 'asc';
  points = points.sort((a, b) => sortDesc ? b.value - a.value : a.value - b.value);
  points = points.slice(0, widget.limit || 10);

  if (chartType === 'table') {
    return {
      points,
      tableRows: points.map((p) => ({ label: p.label, value: formatBudgetMetric(metric, p.value) })),
    };
  }

  return { points };
}

export function suggestBudgetWidgetSize(widget: BudgetWidget, result: BudgetWidgetResult): { colSpan: number; rowSpan: number } {
  const chartType = widget.chartType || 'kpi';
  if (widget.kind === 'quick') {
    const rows = result.listRows?.length || 3;
    return { colSpan: 4, rowSpan: clampBudgetSpan(Math.ceil(rows / 2) + 1, 2, 4) };
  }
  if (chartType === 'kpi' || chartType === 'gauge' || chartType === 'progress_ring') {
    return { colSpan: 3, rowSpan: 2 };
  }
  if (chartType === 'table') {
    return { colSpan: 6, rowSpan: 3 };
  }
  const n = result.points.length || 4;
  if (chartType === 'donut' || chartType === 'pie') return { colSpan: 5, rowSpan: 3 };
  if (chartType === 'horizontal_bar') return { colSpan: 6, rowSpan: clampBudgetSpan(Math.ceil(n / 2) + 1, 2, 5) };
  return { colSpan: 6, rowSpan: 3 };
}
