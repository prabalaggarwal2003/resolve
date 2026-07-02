/** Default KPI dashboard layout */
export const DEFAULT_KPI_DASHBOARD_LAYOUT = {
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

export function getDefaultKpiDashboardLayout() {
  return JSON.parse(JSON.stringify(DEFAULT_KPI_DASHBOARD_LAYOUT));
}
