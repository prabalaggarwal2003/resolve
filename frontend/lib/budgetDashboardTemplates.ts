import type { BudgetDashboardLayout } from './budgetWidgets';

export const DEFAULT_BUDGET_DASHBOARD_LAYOUT: BudgetDashboardLayout = {
  version: 1,
  widgets: [
    { id: 'b1', kind: 'metric', title: 'Total Budget', metric: 'total_allocated', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 3, rowSpan: 1 },
    { id: 'b2', kind: 'metric', title: 'Total Spend', metric: 'total_actual', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 3, rowSpan: 1 },
    { id: 'b3', kind: 'metric', title: 'Remaining', metric: 'total_remaining', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 2, colSpan: 3, rowSpan: 1 },
    { id: 'b4', kind: 'metric', title: 'Utilization %', metric: 'utilization_pct', groupBy: null, chartType: 'gauge', filters: {}, filterFields: [], order: 3, colSpan: 3, rowSpan: 1 },
    { id: 'b5', kind: 'metric', title: 'Allocation by Department', metric: 'allocated', groupBy: 'department', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3 },
    { id: 'b6', kind: 'metric', title: 'Planned vs Actual', metric: 'planned_vs_actual', groupBy: 'month', chartType: 'stacked_bar', filters: {}, filterFields: [], order: 5, colSpan: 6, rowSpan: 3 },
    { id: 'b7', kind: 'metric', title: 'Budget by Type', metric: 'allocated', groupBy: 'budget_type', chartType: 'donut', filters: {}, filterFields: [], order: 6, colSpan: 6, rowSpan: 3 },
    { id: 'b8', kind: 'quick', title: 'Budgets Near Limit', quickType: 'budgets_near_limit', filters: {}, filterFields: [], order: 7, colSpan: 6, rowSpan: 3 },
  ],
};

export function getDefaultBudgetDashboardLayout(): BudgetDashboardLayout {
  return JSON.parse(JSON.stringify(DEFAULT_BUDGET_DASHBOARD_LAYOUT));
}

export const BUDGET_DASHBOARD_TEMPLATES = [
  { id: 'default', name: 'Budget overview', description: 'KPIs, allocation, and spending trends', layout: getDefaultBudgetDashboardLayout() },
  {
    id: 'spending',
    name: 'Spending focus',
    description: 'Vendor and monthly spending analysis',
    layout: {
      version: 1,
      widgets: [
        { id: 's1', kind: 'metric', title: 'Total Spend', metric: 'total_actual', chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 4, rowSpan: 2 },
        { id: 's2', kind: 'metric', title: 'Committed', metric: 'total_committed', chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 4, rowSpan: 2 },
        { id: 's3', kind: 'metric', title: 'Utilization', metric: 'utilization_pct', chartType: 'gauge', filters: {}, filterFields: [], order: 2, colSpan: 4, rowSpan: 2 },
        { id: 's4', kind: 'metric', title: 'Vendor Spending', metric: 'procurement_amount', groupBy: 'vendor', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 3, colSpan: 6, rowSpan: 3 },
        { id: 's5', kind: 'metric', title: 'Monthly Trend', metric: 'planned_vs_actual', groupBy: 'month', chartType: 'line', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3 },
        { id: 's6', kind: 'quick', title: 'Pending Purchases', quickType: 'pending_procurements', filters: {}, filterFields: [], order: 5, colSpan: 6, rowSpan: 3 },
      ],
    } as BudgetDashboardLayout,
  },
  {
    id: 'procurement',
    name: 'Procurement focus',
    description: 'Purchase pipeline, vendors, and payment status',
    layout: {
      version: 1,
      widgets: [
        { id: 'p1', kind: 'metric', title: 'Procurement Spend', metric: 'procurement_amount', chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 3, rowSpan: 2 },
        { id: 'p2', kind: 'metric', title: 'Committed', metric: 'committed_procurement_amount', chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 3, rowSpan: 2 },
        { id: 'p3', kind: 'metric', title: 'Pending Purchases', metric: 'pending_procurement_count', chartType: 'kpi', filters: {}, filterFields: [], order: 2, colSpan: 3, rowSpan: 2 },
        { id: 'p4', kind: 'metric', title: 'Overdue Payments', metric: 'overdue_payment_count', chartType: 'kpi', filters: {}, filterFields: [], order: 3, colSpan: 3, rowSpan: 2 },
        { id: 'p5', kind: 'metric', title: 'By Lifecycle Stage', metric: 'procurement_amount', groupBy: 'lifecycle_stage', chartType: 'donut', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3 },
        { id: 'p6', kind: 'metric', title: 'By Vendor', metric: 'procurement_amount', groupBy: 'vendor', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 5, colSpan: 6, rowSpan: 3 },
        { id: 'p7', kind: 'quick', title: 'Recent Procurements', quickType: 'recent_procurements', filters: {}, filterFields: [], order: 6, colSpan: 6, rowSpan: 3 },
        { id: 'p8', kind: 'quick', title: 'Overdue Payments', quickType: 'overdue_payments', filters: {}, filterFields: [], order: 7, colSpan: 6, rowSpan: 3 },
      ],
    } as BudgetDashboardLayout,
  },
];

export function getTemplateById(id: string) {
  return BUDGET_DASHBOARD_TEMPLATES.find((t) => t.id === id);
}

export function cloneBudgetTemplateLayout(templateId: string): BudgetDashboardLayout {
  const tpl = getTemplateById(templateId);
  if (!tpl) return getDefaultBudgetDashboardLayout();
  const layout = JSON.parse(JSON.stringify(tpl.layout)) as BudgetDashboardLayout;
  layout.widgets = layout.widgets.map((w) => ({ ...w, id: crypto.randomUUID() }));
  return layout;
}
