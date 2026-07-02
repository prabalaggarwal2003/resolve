/** Default home dashboard widget layout */
export const DEFAULT_HOME_DASHBOARD_LAYOUT = {
  version: 1,
  widgets: [
    { id: 'h1', kind: 'kpi', metric: 'total_assets', title: 'Total Assets', size: 'small', filters: {}, filterFields: [], order: 0, visible: true, sizeLocked: false },
    { id: 'h2', kind: 'kpi', metric: 'active_assets', title: 'Active Assets', size: 'small', filters: {}, filterFields: [], order: 1, visible: true, sizeLocked: false },
    { id: 'h3', kind: 'kpi', metric: 'under_maintenance', title: 'Under Maintenance', size: 'small', filters: {}, filterFields: [], order: 2, visible: true, sizeLocked: false },
    { id: 'h4', kind: 'kpi', metric: 'warranty_expiring', title: 'Warranty Expiring', size: 'small', filters: {}, filterFields: [], order: 3, visible: true, sizeLocked: false },
    { id: 'h5', kind: 'kpi', metric: 'replacement_required', title: 'Needs Replacement', size: 'small', filters: {}, filterFields: [], order: 4, visible: true, sizeLocked: false },
    { id: 'h6', kind: 'attention', title: 'Attention Required', size: 'large', filters: {}, filterFields: [], order: 5, visible: true, sizeLocked: false },
    { id: 'h7', kind: 'activity', title: 'Recent Activity', size: 'large', filters: {}, filterFields: [], order: 6, visible: true, sizeLocked: false },
    { id: 'h8', kind: 'chart', metric: 'by_group', title: 'Assets by Group', size: 'medium', filters: {}, filterFields: [], order: 7, visible: true, sizeLocked: false },
    { id: 'h9', kind: 'chart', metric: 'by_status', title: 'Assets by Status', size: 'medium', filters: {}, filterFields: [], order: 8, visible: true, sizeLocked: false },
    { id: 'h10', kind: 'chart', metric: 'by_location', title: 'Assets by Location', size: 'medium', filters: {}, filterFields: [], order: 9, visible: true, sizeLocked: false },
    { id: 'h11', kind: 'warranty_overview', title: 'Warranty Overview', size: 'medium', filters: {}, filterFields: [], order: 10, visible: true, sizeLocked: false },
    { id: 'h12', kind: 'financial', title: 'Financial Snapshot', size: 'medium', filters: {}, filterFields: [], order: 11, visible: true, sizeLocked: false },
    { id: 'h13', kind: 'latest_assets', title: 'Latest Assets', size: 'medium', filters: {}, filterFields: [], order: 12, visible: true, sizeLocked: false },
    { id: 'h14', kind: 'performance', title: 'Performance', size: 'medium', filters: {}, filterFields: [], order: 13, visible: true, sizeLocked: false },
    { id: 'h15', kind: 'notifications', title: 'Notifications', size: 'medium', filters: {}, filterFields: [], order: 14, visible: true, sizeLocked: false },
    { id: 'h16', kind: 'system_status', title: 'System Status', size: 'medium', filters: {}, filterFields: [], order: 15, visible: true, sizeLocked: false },
  ],
};

export function getDefaultHomeDashboardLayout() {
  return JSON.parse(JSON.stringify(DEFAULT_HOME_DASHBOARD_LAYOUT));
}
