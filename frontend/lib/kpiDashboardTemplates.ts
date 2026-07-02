import type { KpiDashboardLayout } from './kpiWidgets';
import { mergeKpiLayout } from './kpiWidgets';

function newWidgetId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `kw-${Date.now()}-${Math.random()}`;
}

/** Deep-clone a template layout with fresh widget ids for applying to an existing dashboard. */
export function cloneKpiTemplateLayout(layout: KpiDashboardLayout): KpiDashboardLayout {
  const merged = mergeKpiLayout(layout);
  return {
    version: merged.version,
    widgets: merged.widgets.map((w, i) => ({
      ...w,
      id: newWidgetId(),
      order: i,
    })),
  };
}

export function getDefaultKpiDashboardLayout(): KpiDashboardLayout {
  return {
    version: 1,
    widgets: [
      { id: 'k1', kind: 'metric', title: 'Total Assets', metric: 'total_assets', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 3, rowSpan: 1, sizeLocked: false },
      { id: 'k2', kind: 'metric', title: 'Active Assets', metric: 'active_assets', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 3, rowSpan: 1, sizeLocked: false },
      { id: 'k3', kind: 'metric', title: 'Utilization %', metric: 'utilization_pct', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 2, colSpan: 3, rowSpan: 1, sizeLocked: false },
      { id: 'k4', kind: 'metric', title: 'Total Purchase Value', metric: 'total_purchase', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 3, colSpan: 3, rowSpan: 1, sizeLocked: false },
      { id: 'k5', kind: 'metric', title: 'Assets by Group', metric: 'asset_count', groupBy: 'group', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3, sizeLocked: false },
      { id: 'k6', kind: 'metric', title: 'Warranty Status', metric: 'warranty', groupBy: 'warranty_status', chartType: 'donut', filters: {}, filterFields: [], order: 5, colSpan: 6, rowSpan: 3, sizeLocked: false },
      { id: 'k7', kind: 'quick', title: 'Latest Issues', quickType: 'latest_issues', filters: {}, filterFields: [], order: 6, colSpan: 6, rowSpan: 3, sizeLocked: false },
      { id: 'k8', kind: 'quick', title: 'Low Health Assets', quickType: 'low_health_assets', filters: {}, filterFields: [], order: 7, colSpan: 6, rowSpan: 3, sizeLocked: false },
    ],
  };
}

export type KpiDashboardTemplate = {
  id: string;
  name: string;
  description: string;
  layout: KpiDashboardLayout;
};

const base = (widgets: KpiDashboardLayout['widgets']): KpiDashboardLayout => ({ version: 1, widgets });

export const KPI_DASHBOARD_TEMPLATES: KpiDashboardTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Dashboard',
    description: 'High-level portfolio overview for leadership',
    layout: base([
      { id: 'e1', kind: 'metric', title: 'Total Assets', metric: 'total_assets', chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 3, rowSpan: 1 },
      { id: 'e2', kind: 'metric', title: 'Total Purchase Value', metric: 'total_purchase', chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 3, rowSpan: 1 },
      { id: 'e3', kind: 'metric', title: 'Current Book Value', metric: 'current_value', chartType: 'kpi', filters: {}, filterFields: [], order: 2, colSpan: 3, rowSpan: 1 },
      { id: 'e4', kind: 'metric', title: 'Utilization %', metric: 'utilization_pct', chartType: 'gauge', filters: {}, filterFields: [], order: 3, colSpan: 3, rowSpan: 2 },
      { id: 'e5', kind: 'metric', title: 'Assets by Department', metric: 'asset_count', groupBy: 'department', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3 },
      { id: 'e6', kind: 'metric', title: 'Warranty Status', metric: 'warranty', groupBy: 'warranty_status', chartType: 'donut', filters: {}, filterFields: [], order: 5, colSpan: 6, rowSpan: 3 },
      { id: 'e7', kind: 'quick', title: 'Replacement Recommendations', quickType: 'replacement_recommendations', filters: {}, filterFields: [], order: 6, colSpan: 12, rowSpan: 3 },
    ]),
  },
  {
    id: 'it_manager',
    name: 'IT Manager Dashboard',
    description: 'IT asset health, issues, and utilization',
    layout: base([
      { id: 'i1', kind: 'metric', title: 'Active Assets', metric: 'active_assets', chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 4, rowSpan: 1 },
      { id: 'i2', kind: 'metric', title: 'Open Issues', metric: 'issues', chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 4, rowSpan: 1 },
      { id: 'i3', kind: 'metric', title: 'Avg Health Score', metric: 'health_score', chartType: 'gauge', filters: {}, filterFields: [], order: 2, colSpan: 4, rowSpan: 2 },
      { id: 'i4', kind: 'quick', title: 'Latest Issues', quickType: 'latest_issues', filters: {}, filterFields: [], order: 3, colSpan: 6, rowSpan: 3 },
      { id: 'i5', kind: 'quick', title: 'Low Health Assets', quickType: 'low_health_assets', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3 },
      { id: 'i6', kind: 'metric', title: 'Assets by Template', metric: 'asset_count', groupBy: 'template', chartType: 'bar', filters: {}, filterFields: [], order: 5, colSpan: 12, rowSpan: 3 },
    ]),
  },
  {
    id: 'facilities',
    name: 'Facilities Dashboard',
    description: 'Locations, maintenance, and asset movements',
    layout: base([
      { id: 'f1', kind: 'metric', title: 'Assets by Location', metric: 'asset_count', groupBy: 'location', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 0, colSpan: 8, rowSpan: 4 },
      { id: 'f2', kind: 'quick', title: 'Upcoming Maintenance', quickType: 'upcoming_maintenance', filters: {}, filterFields: [], order: 1, colSpan: 4, rowSpan: 4 },
      { id: 'f3', kind: 'quick', title: 'Recent Movements', quickType: 'recent_movements', filters: {}, filterFields: [], order: 2, colSpan: 6, rowSpan: 3 },
      { id: 'f4', kind: 'metric', title: 'Issues by Location', metric: 'issues', groupBy: 'location', chartType: 'bar', filters: {}, filterFields: [], order: 3, colSpan: 6, rowSpan: 3 },
    ]),
  },
  {
    id: 'finance',
    name: 'Finance Dashboard',
    description: 'Purchase value, depreciation, and book value',
    layout: base([
      { id: 'fn1', kind: 'metric', title: 'Total Purchase Value', metric: 'total_purchase', chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 4, rowSpan: 1 },
      { id: 'fn2', kind: 'metric', title: 'Current Book Value', metric: 'current_value', chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 4, rowSpan: 1 },
      { id: 'fn3', kind: 'metric', title: 'Total Depreciation', metric: 'total_depreciation', chartType: 'kpi', filters: {}, filterFields: [], order: 2, colSpan: 4, rowSpan: 1 },
      { id: 'fn4', kind: 'metric', title: 'Depreciation by Group', metric: 'depreciation', groupBy: 'group', chartType: 'stacked_bar', filters: {}, filterFields: [], order: 3, colSpan: 6, rowSpan: 3 },
      { id: 'fn5', kind: 'metric', title: 'Purchase by Year', metric: 'purchase_value', groupBy: 'purchase_year', chartType: 'line', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3 },
      { id: 'fn6', kind: 'metric', title: 'Average Asset Cost', metric: 'average_cost', chartType: 'kpi', filters: {}, filterFields: [], order: 5, colSpan: 4, rowSpan: 1 },
    ]),
  },
];

export function getTemplateById(id: string) {
  return KPI_DASHBOARD_TEMPLATES.find((t) => t.id === id);
}
