import type { HomeDashboardLayout } from './homeDashboardWidgets';
import { mergeHomeLayout } from './homeDashboardWidgets';

function newWidgetId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `hw-${Date.now()}-${Math.random()}`;
}

/** Deep-clone a template layout with fresh widget ids for applying to an existing dashboard. */
export function cloneHomeTemplateLayout(layout: HomeDashboardLayout): HomeDashboardLayout {
  const merged = mergeHomeLayout(layout);
  return {
    version: merged.version,
    widgets: merged.widgets.map((w, i) => ({
      ...w,
      id: newWidgetId(),
      order: i,
    })),
  };
}

/** Default layout — widget ids match backend `homeDashboardDefaults.js`. */
export function getDefaultHomeDashboardLayout(): HomeDashboardLayout {
  return {
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
}

export type HomeDashboardTemplate = {
  id: string;
  name: string;
  description: string;
  layout: HomeDashboardLayout;
};

const base = (widgets: HomeDashboardLayout['widgets']): HomeDashboardLayout => ({ version: 1, widgets });

export const HOME_DASHBOARD_TEMPLATES: HomeDashboardTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Dashboard',
    description: 'High-level portfolio overview for leadership',
    layout: base([
      { id: 'ex1', kind: 'kpi', metric: 'total_assets', title: 'Total Assets', size: 'small', filters: {}, filterFields: [], order: 0, visible: true, sizeLocked: false },
      { id: 'ex2', kind: 'kpi', metric: 'active_assets', title: 'Active Assets', size: 'small', filters: {}, filterFields: [], order: 1, visible: true, sizeLocked: false },
      { id: 'ex3', kind: 'kpi', metric: 'warranty_expiring', title: 'Warranty Expiring', size: 'small', filters: {}, filterFields: [], order: 2, visible: true, sizeLocked: false },
      { id: 'ex4', kind: 'kpi', metric: 'replacement_required', title: 'Needs Replacement', size: 'small', filters: {}, filterFields: [], order: 3, visible: true, sizeLocked: false },
      { id: 'ex5', kind: 'attention', title: 'Attention Required', size: 'large', filters: {}, filterFields: [], order: 4, visible: true, sizeLocked: false },
      { id: 'ex6', kind: 'financial', title: 'Financial Snapshot', size: 'medium', filters: {}, filterFields: [], order: 5, visible: true, sizeLocked: false },
      { id: 'ex7', kind: 'chart', metric: 'by_group', title: 'Assets by Group', size: 'medium', filters: {}, filterFields: [], order: 6, visible: true, sizeLocked: false },
      { id: 'ex8', kind: 'performance', title: 'Performance', size: 'medium', filters: {}, filterFields: [], order: 7, visible: true, sizeLocked: false },
    ]),
  },
  {
    id: 'operations',
    name: 'Operations Dashboard',
    description: 'Day-to-day asset operations and activity',
    layout: base([
      { id: 'op1', kind: 'kpi', metric: 'active_assets', title: 'Active Assets', size: 'small', filters: {}, filterFields: [], order: 0, visible: true, sizeLocked: false },
      { id: 'op2', kind: 'kpi', metric: 'under_maintenance', title: 'Under Maintenance', size: 'small', filters: {}, filterFields: [], order: 1, visible: true, sizeLocked: false },
      { id: 'op3', kind: 'kpi', metric: 'total_assets', title: 'Total Assets', size: 'small', filters: {}, filterFields: [], order: 2, visible: true, sizeLocked: false },
      { id: 'op4', kind: 'attention', title: 'Attention Required', size: 'large', filters: {}, filterFields: [], order: 3, visible: true, sizeLocked: false },
      { id: 'op5', kind: 'activity', title: 'Recent Activity', size: 'large', filters: {}, filterFields: [], order: 4, visible: true, sizeLocked: false },
      { id: 'op6', kind: 'chart', metric: 'by_location', title: 'Assets by Location', size: 'medium', filters: {}, filterFields: [], order: 5, visible: true, sizeLocked: false },
      { id: 'op7', kind: 'latest_assets', title: 'Latest Assets', size: 'medium', filters: {}, filterFields: [], order: 6, visible: true, sizeLocked: false },
    ]),
  },
  {
    id: 'finance',
    name: 'Finance Dashboard',
    description: 'Purchase value, depreciation, and warranty exposure',
    layout: base([
      { id: 'fn1', kind: 'kpi', metric: 'total_assets', title: 'Total Assets', size: 'small', filters: {}, filterFields: [], order: 0, visible: true, sizeLocked: false },
      { id: 'fn2', kind: 'kpi', metric: 'replacement_required', title: 'Needs Replacement', size: 'small', filters: {}, filterFields: [], order: 1, visible: true, sizeLocked: false },
      { id: 'fn3', kind: 'financial', title: 'Financial Snapshot', size: 'large', filters: {}, filterFields: [], order: 2, visible: true, sizeLocked: false },
      { id: 'fn4', kind: 'warranty_overview', title: 'Warranty Overview', size: 'medium', filters: {}, filterFields: [], order: 3, visible: true, sizeLocked: false },
      { id: 'fn5', kind: 'chart', metric: 'by_group', title: 'Assets by Group', size: 'medium', filters: {}, filterFields: [], order: 4, visible: true, sizeLocked: false },
      { id: 'fn6', kind: 'kpi', metric: 'warranty_expiring', title: 'Warranty Expiring', size: 'small', filters: {}, filterFields: [], order: 5, visible: true, sizeLocked: false },
    ]),
  },
  {
    id: 'maintenance',
    name: 'Maintenance Dashboard',
    description: 'Maintenance workload, warranties, and alerts',
    layout: base([
      { id: 'mt1', kind: 'kpi', metric: 'under_maintenance', title: 'Under Maintenance', size: 'small', filters: {}, filterFields: [], order: 0, visible: true, sizeLocked: false },
      { id: 'mt2', kind: 'kpi', metric: 'warranty_expiring', title: 'Warranty Expiring', size: 'small', filters: {}, filterFields: [], order: 1, visible: true, sizeLocked: false },
      { id: 'mt3', kind: 'kpi', metric: 'replacement_required', title: 'Needs Replacement', size: 'small', filters: {}, filterFields: [], order: 2, visible: true, sizeLocked: false },
      { id: 'mt4', kind: 'attention', title: 'Attention Required', size: 'large', filters: {}, filterFields: [], order: 3, visible: true, sizeLocked: false },
      { id: 'mt5', kind: 'activity', title: 'Recent Activity', size: 'medium', filters: {}, filterFields: [], order: 4, visible: true, sizeLocked: false },
      { id: 'mt6', kind: 'notifications', title: 'Notifications', size: 'medium', filters: {}, filterFields: [], order: 5, visible: true, sizeLocked: false },
      { id: 'mt7', kind: 'performance', title: 'Performance', size: 'medium', filters: {}, filterFields: [], order: 6, visible: true, sizeLocked: false },
    ]),
  },
  {
    id: 'it',
    name: 'IT Dashboard',
    description: 'IT asset inventory, status, and system health',
    layout: base([
      { id: 'it1', kind: 'kpi', metric: 'active_assets', title: 'Active Assets', size: 'small', filters: {}, filterFields: [], order: 0, visible: true, sizeLocked: false },
      { id: 'it2', kind: 'kpi', metric: 'total_assets', title: 'Total Assets', size: 'small', filters: {}, filterFields: [], order: 1, visible: true, sizeLocked: false },
      { id: 'it3', kind: 'chart', metric: 'by_status', title: 'Assets by Status', size: 'medium', filters: {}, filterFields: [], order: 2, visible: true, sizeLocked: false },
      { id: 'it4', kind: 'latest_assets', title: 'Latest Assets', size: 'medium', filters: {}, filterFields: [], order: 3, visible: true, sizeLocked: false },
      { id: 'it5', kind: 'system_status', title: 'System Status', size: 'medium', filters: {}, filterFields: [], order: 4, visible: true, sizeLocked: false },
      { id: 'it6', kind: 'performance', title: 'Performance', size: 'medium', filters: {}, filterFields: [], order: 5, visible: true, sizeLocked: false },
    ]),
  },
];

export function getTemplateById(id: string) {
  return HOME_DASHBOARD_TEMPLATES.find((t) => t.id === id);
}

const ROLE_TEMPLATE_MAP: Record<string, string> = {
  super_admin: 'executive',
  admin: 'executive',
  principal: 'executive',
  hod: 'finance',
  manager: 'operations',
  teacher: 'it',
  lab_technician: 'maintenance',
  student: 'operations',
  reporter: 'operations',
  custom: 'operations',
};

export function getRoleDefaultTemplateId(role: string): string {
  return ROLE_TEMPLATE_MAP[role] || 'operations';
}
