/** Default budget module configuration seeded per organization */

export const DEFAULT_BUDGET_TYPES = [
  { id: 'annual', name: 'Annual', description: 'Full financial year budget', isDefault: true },
  { id: 'quarterly', name: 'Quarterly', description: 'Quarterly allocation' },
  { id: 'monthly', name: 'Monthly', description: 'Monthly allocation' },
  { id: 'project', name: 'Project Budget', description: 'Project-specific budget' },
  { id: 'department', name: 'Department Budget', description: 'Department operating budget' },
  { id: 'capex', name: 'Capital Expenditure (CapEx)', description: 'Capital asset purchases' },
  { id: 'opex', name: 'Operational Expenditure (OpEx)', description: 'Operating expenses' },
  { id: 'grant', name: 'Grant', description: 'Grant-funded budget' },
  { id: 'research', name: 'Research Fund', description: 'Research funding' },
];

export const DEFAULT_BUDGET_STATUSES = [
  { id: 'draft', name: 'Draft', color: '#9ca3af', isClosed: false, isDefault: true },
  { id: 'active', name: 'Active', color: '#10b981', isClosed: false },
  { id: 'closed', name: 'Closed', color: '#6366f1', isClosed: true },
  { id: 'archived', name: 'Archived', color: '#6b7280', isClosed: true },
];

export const DEFAULT_FUNDING_SOURCES = [
  { id: 'government_grant', name: 'Government Grant' },
  { id: 'research_grant', name: 'Research Grant' },
  { id: 'csr', name: 'CSR Funding' },
  { id: 'internal', name: 'Internal Budget' },
  { id: 'donation', name: 'Donations' },
  { id: 'capital', name: 'Capital Budget' },
  { id: 'operational', name: 'Operational Budget' },
];

export const DEFAULT_BUDGET_DIMENSIONS = [
  { key: 'departmentId', label: 'Department', enabled: true, required: false },
  { key: 'groupId', label: 'Asset Group', enabled: true, required: false },
  { key: 'category', label: 'Category', enabled: true, required: false },
  { key: 'templateId', label: 'Template', enabled: false, required: false },
  { key: 'locationId', label: 'Location', enabled: true, required: false },
  { key: 'project', label: 'Project', enabled: false, required: false },
  { key: 'vendorId', label: 'Vendor', enabled: false, required: false },
  { key: 'costCenter', label: 'Cost Center', enabled: false, required: false },
  { key: 'branch', label: 'Branch', enabled: false, required: false },
  { key: 'campus', label: 'Campus', enabled: false, required: false },
  { key: 'warehouse', label: 'Warehouse', enabled: false, required: false },
  { key: 'fundingSourceId', label: 'Funding Source', enabled: true, required: false },
  { key: 'grant', label: 'Grant', enabled: false, required: false },
  { key: 'businessUnit', label: 'Business Unit', enabled: false, required: false },
  { key: 'customTags', label: 'Custom Tags', enabled: false, required: false },
];

export const DEFAULT_BUDGET_CUSTOM_FIELDS = [];

/** Procurement lifecycle stages — bucket drives planned / committed / actual rollups */
export const DEFAULT_PROCUREMENT_LIFECYCLE_STAGES = [
  { id: 'planned', name: 'Planned Purchase', color: '#9ca3af', bucket: 'planned', isDefault: true },
  { id: 'approved', name: 'Approved Purchase', color: '#3b82f6', bucket: 'committed' },
  { id: 'ordered', name: 'Ordered', color: '#8b5cf6', bucket: 'committed' },
  { id: 'received', name: 'Received', color: '#10b981', bucket: 'actual' },
  { id: 'assets_created', name: 'Assets Created', color: '#059669', bucket: 'actual' },
  { id: 'cancelled', name: 'Cancelled', color: '#ef4444', bucket: 'cancelled' },
];

export const DEFAULT_PROCUREMENT_PAYMENT_STATUSES = [
  { id: 'unpaid', name: 'Unpaid', color: '#f59e0b', isDefault: true },
  { id: 'partial', name: 'Partially Paid', color: '#3b82f6' },
  { id: 'paid', name: 'Paid', color: '#10b981' },
  { id: 'overdue', name: 'Overdue', color: '#ef4444' },
];

export const DEFAULT_PROCUREMENT_CUSTOM_FIELDS = [];

export const DEFAULT_BUDGET_SETTINGS = {
  autoUpdateOnAssetCreate: true,
  autoUpdateOnPurchaseApprove: true,
  warnThresholdPct: 80,
  criticalThresholdPct: 100,
};

export function getDefaultBudgetOrgConfig() {
  return {
    budgetTypes: JSON.parse(JSON.stringify(DEFAULT_BUDGET_TYPES)),
    budgetStatuses: JSON.parse(JSON.stringify(DEFAULT_BUDGET_STATUSES)),
    fundingSources: JSON.parse(JSON.stringify(DEFAULT_FUNDING_SOURCES)),
    enabledDimensions: JSON.parse(JSON.stringify(DEFAULT_BUDGET_DIMENSIONS)),
    customFields: JSON.parse(JSON.stringify(DEFAULT_BUDGET_CUSTOM_FIELDS)),
    procurementLifecycleStages: JSON.parse(JSON.stringify(DEFAULT_PROCUREMENT_LIFECYCLE_STAGES)),
    procurementPaymentStatuses: JSON.parse(JSON.stringify(DEFAULT_PROCUREMENT_PAYMENT_STATUSES)),
    procurementCustomFields: JSON.parse(JSON.stringify(DEFAULT_PROCUREMENT_CUSTOM_FIELDS)),
    settings: { ...DEFAULT_BUDGET_SETTINGS },
  };
}
