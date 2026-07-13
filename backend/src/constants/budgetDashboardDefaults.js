export const DEFAULT_BUDGET_DASHBOARD_LAYOUT = {
  version: 1,
  widgets: [
    { id: 'b1', kind: 'metric', title: 'Total Budget', metric: 'total_allocated', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 3, rowSpan: 1, sizeLocked: false },
    { id: 'b2', kind: 'metric', title: 'Total Spend', metric: 'total_actual', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 3, rowSpan: 1, sizeLocked: false },
    { id: 'b3', kind: 'metric', title: 'Remaining', metric: 'total_remaining', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 2, colSpan: 3, rowSpan: 1, sizeLocked: false },
    { id: 'b4', kind: 'metric', title: 'Utilization %', metric: 'utilization_pct', groupBy: null, chartType: 'gauge', filters: {}, filterFields: [], order: 3, colSpan: 3, rowSpan: 1, sizeLocked: false },
    { id: 'b5', kind: 'metric', title: 'Allocation by Department', metric: 'allocated', groupBy: 'department', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3, sizeLocked: false },
    { id: 'b6', kind: 'metric', title: 'Planned vs Actual', metric: 'planned_vs_actual', groupBy: 'month', chartType: 'stacked_bar', filters: {}, filterFields: [], order: 5, colSpan: 6, rowSpan: 3, sizeLocked: false },
    { id: 'b7', kind: 'metric', title: 'Budget by Type', metric: 'allocated', groupBy: 'budget_type', chartType: 'donut', filters: {}, filterFields: [], order: 6, colSpan: 6, rowSpan: 3, sizeLocked: false },
    { id: 'b8', kind: 'quick', title: 'Budgets Near Limit', quickType: 'budgets_near_limit', filters: {}, filterFields: [], order: 7, colSpan: 6, rowSpan: 3, sizeLocked: false },
  ],
};

export function getDefaultBudgetDashboardLayout() {
  return JSON.parse(JSON.stringify(DEFAULT_BUDGET_DASHBOARD_LAYOUT));
}
