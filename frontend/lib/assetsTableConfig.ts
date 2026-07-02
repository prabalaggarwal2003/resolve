export type ColumnId =
  | 'assetId'
  | 'name'
  | 'category'
  | 'assetGroup'
  | 'status'
  | 'location'
  | 'assignedTo'
  | 'model'
  | 'serialNumber'
  | 'department'
  | 'cost'
  | 'purchaseDate'
  | 'createdAt'
  | 'warrantyExpiry'
  | 'updatedAt'
  | 'employeeCode'
  | 'tags';

export type ColumnConfig = { id: ColumnId; visible: boolean };

export type FilterOperator =
  | 'contains'
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'before'
  | 'after'
  | 'on_or_before'
  | 'on_or_after'
  | 'starts_with'
  | 'empty'
  | 'not_empty';

export type AdvancedFilter = {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
};

export type SavedView = {
  id: string;
  name: string;
  columns: ColumnConfig[];
  sort: string;
  order: 'asc' | 'desc';
  globalSearch: string;
  advancedFilters: AdvancedFilter[];
  basicFilters: BasicFilters;
};

export type AssetListPreferences = {
  columns: ColumnConfig[];
  savedViews: SavedView[];
  activeViewId: string | null;
  sort: string;
  order: 'asc' | 'desc';
  pageSize: number;
  globalSearch: string;
  advancedFilters: AdvancedFilter[];
  basicFilters: BasicFilters;
};

export type BasicFilters = {
  status: string;
  category: string;
  groupId: string;
  departmentId: string;
  locationIds: string[];
  locationIncludeChildren: boolean;
};

export const DEFAULT_BASIC_FILTERS: BasicFilters = {
  status: '',
  category: '',
  groupId: '',
  departmentId: '',
  locationIds: [],
  locationIncludeChildren: true,
};

export function hasActiveBasicFilters(bf?: Partial<BasicFilters> | null): boolean {
  const f = { ...DEFAULT_BASIC_FILTERS, ...bf };
  return Boolean(f.status || f.category || f.groupId || f.departmentId || f.locationIds.length > 0);
}

export function normalizeBasicFilters(
  incoming?: Partial<BasicFilters> & { locationId?: string } | null
): BasicFilters {
  const base = { ...DEFAULT_BASIC_FILTERS };
  if (!incoming) return base;

  const legacyId = incoming.locationId?.trim();
  const locationIds =
    Array.isArray(incoming.locationIds) && incoming.locationIds.length
      ? incoming.locationIds.filter(Boolean)
      : legacyId
      ? [legacyId]
      : [];

  return {
    status: incoming.status ?? '',
    category: incoming.category ?? '',
    groupId: incoming.groupId ?? '',
    departmentId: incoming.departmentId ?? '',
    locationIds,
    locationIncludeChildren: incoming.locationIncludeChildren !== false,
  };
}

export const SORT_OPTIONS: { value: string; sort: string; order: 'asc' | 'desc'; label: string }[] = [
  { value: 'createdAt-desc', sort: 'createdAt', order: 'desc', label: 'Date added (newest)' },
  { value: 'createdAt-asc', sort: 'createdAt', order: 'asc', label: 'Date added (oldest)' },
  { value: 'purchaseDate-desc', sort: 'purchaseDate', order: 'desc', label: 'Purchase date (newest)' },
  { value: 'purchaseDate-asc', sort: 'purchaseDate', order: 'asc', label: 'Purchase date (oldest)' },
  { value: 'cost-desc', sort: 'cost', order: 'desc', label: 'Cost (high to low)' },
  { value: 'cost-asc', sort: 'cost', order: 'asc', label: 'Cost (low to high)' },
  { value: 'name-asc', sort: 'name', order: 'asc', label: 'Name (A–Z)' },
  { value: 'name-desc', sort: 'name', order: 'desc', label: 'Name (Z–A)' },
  { value: 'warrantyExpiry-asc', sort: 'warrantyExpiry', order: 'asc', label: 'Warranty expiry (soonest)' },
  { value: 'warrantyExpiry-desc', sort: 'warrantyExpiry', order: 'desc', label: 'Warranty expiry (latest)' },
  { value: 'updatedAt-desc', sort: 'updatedAt', order: 'desc', label: 'Last updated (newest)' },
  { value: 'assetId-asc', sort: 'assetId', order: 'asc', label: 'Asset ID (A–Z)' },
];

export const COLUMN_DEFS: Record<
  ColumnId,
  { label: string; sortable: boolean; sortKey?: string }
> = {
  assetId: { label: 'Asset ID', sortable: true, sortKey: 'assetId' },
  name: { label: 'Asset Name', sortable: true, sortKey: 'name' },
  category: { label: 'Category', sortable: true, sortKey: 'category' },
  assetGroup: { label: 'Asset group', sortable: false },
  status: { label: 'Status', sortable: true, sortKey: 'status' },
  location: { label: 'Location', sortable: false },
  assignedTo: { label: 'Assigned To', sortable: false },
  model: { label: 'Model', sortable: true, sortKey: 'model' },
  serialNumber: { label: 'Serial Number', sortable: true, sortKey: 'serialNumber' },
  department: { label: 'Department', sortable: false },
  cost: { label: 'Cost', sortable: true, sortKey: 'cost' },
  purchaseDate: { label: 'Purchase Date', sortable: true, sortKey: 'purchaseDate' },
  createdAt: { label: 'Date Added', sortable: true, sortKey: 'createdAt' },
  warrantyExpiry: { label: 'Warranty Expiry', sortable: true, sortKey: 'warrantyExpiry' },
  updatedAt: { label: 'Last Updated', sortable: true, sortKey: 'updatedAt' },
  employeeCode: { label: 'Employee Code', sortable: false },
  tags: { label: 'Tags', sortable: false },
};

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'assetId', visible: true },
  { id: 'name', visible: true },
  { id: 'category', visible: true },
  { id: 'assetGroup', visible: true },
  { id: 'status', visible: true },
  { id: 'location', visible: true },
  { id: 'assignedTo', visible: true },
  { id: 'model', visible: false },
  { id: 'serialNumber', visible: false },
  { id: 'department', visible: false },
  { id: 'cost', visible: false },
  { id: 'purchaseDate', visible: false },
  { id: 'createdAt', visible: false },
  { id: 'warrantyExpiry', visible: false },
  { id: 'updatedAt', visible: false },
  { id: 'employeeCode', visible: false },
  { id: 'tags', visible: false },
];

export type FilterFieldType = 'text' | 'number' | 'date' | 'select' | 'reference';

export type FilterFieldDef = {
  field: string;
  label: string;
  type: FilterFieldType;
  options?: { value: string; label: string }[];
};

export const FILTER_FIELD_DEFS: FilterFieldDef[] = [
  { field: 'assetId', label: 'Asset ID', type: 'text' },
  { field: 'name', label: 'Asset Name', type: 'text' },
  { field: 'model', label: 'Model', type: 'text' },
  { field: 'serialNumber', label: 'Serial Number', type: 'text' },
  { field: 'category', label: 'Category', type: 'text' },
  { field: 'groupId', label: 'Asset group', type: 'reference' },
  {
    field: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'available', label: 'Available' },
      { value: 'in_use', label: 'In use' },
      { value: 'under_maintenance', label: 'Under maintenance' },
      { value: 'retired', label: 'Retired' },
      { value: 'working', label: 'Working' },
      { value: 'needs_repair', label: 'Needs repair' },
      { value: 'out_of_service', label: 'Out of service' },
    ],
  },
  { field: 'assignedToName', label: 'Assigned To (name)', type: 'text' },
  { field: 'assignedTo', label: 'Assigned User (account)', type: 'reference' },
  { field: 'assignedToEmployeeCode', label: 'Employee Code', type: 'text' },
  { field: 'locationId', label: 'Location', type: 'reference' },
  { field: 'departmentId', label: 'Department', type: 'reference' },
  { field: 'vendorId', label: 'Vendor', type: 'reference' },
  { field: 'cost', label: 'Cost', type: 'number' },
  { field: 'purchaseDate', label: 'Purchase Date', type: 'date' },
  { field: 'warrantyExpiry', label: 'Warranty Expiry', type: 'date' },
  { field: 'amcExpiry', label: 'AMC Expiry', type: 'date' },
  { field: 'nextMaintenanceDate', label: 'Next Maintenance', type: 'date' },
  { field: 'createdAt', label: 'Date Added', type: 'date' },
  { field: 'updatedAt', label: 'Last Updated', type: 'date' },
];

export const OPERATORS_BY_TYPE: Record<FilterFieldType, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not equals' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'empty', label: 'Is empty' },
    { value: 'not_empty', label: 'Is not empty' },
  ],
  number: [
    { value: 'eq', label: '=' },
    { value: 'ne', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '≥' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '≤' },
    { value: 'empty', label: 'Is empty' },
    { value: 'not_empty', label: 'Is not empty' },
  ],
  date: [
    { value: 'eq', label: 'On' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'on_or_before', label: 'On or before' },
    { value: 'on_or_after', label: 'On or after' },
    { value: 'empty', label: 'Is empty' },
    { value: 'not_empty', label: 'Is not empty' },
  ],
  select: [
    { value: 'eq', label: 'Is' },
    { value: 'ne', label: 'Is not' },
    { value: 'empty', label: 'Is empty' },
    { value: 'not_empty', label: 'Is not empty' },
  ],
  reference: [
    { value: 'eq', label: 'Is' },
    { value: 'ne', label: 'Is not' },
    { value: 'empty', label: 'Is empty' },
    { value: 'not_empty', label: 'Is not empty' },
  ],
};

export function defaultPreferences(): AssetListPreferences {
  return {
    columns: DEFAULT_COLUMNS.map((c) => ({ ...c })),
    savedViews: [],
    activeViewId: null,
    sort: 'createdAt',
    order: 'desc',
    pageSize: 25,
    globalSearch: '',
    advancedFilters: [],
    basicFilters: { ...DEFAULT_BASIC_FILTERS },
  };
}

export function newFilter(): AdvancedFilter {
  return {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    field: 'name',
    operator: 'contains',
    value: '',
  };
}

export function newSavedView(name: string, prefs: AssetListPreferences): SavedView {
  return {
    id: `v_${Date.now()}`,
    name,
    columns: prefs.columns.map((c) => ({ ...c })),
    sort: prefs.sort,
    order: prefs.order,
    globalSearch: prefs.globalSearch,
    advancedFilters: prefs.advancedFilters.map((f) => ({ ...f })),
    basicFilters: normalizeBasicFilters(prefs.basicFilters),
  };
}

export const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  in_use: 'In use',
  under_maintenance: 'Under maintenance',
  retired: 'Retired',
  working: 'Working',
  needs_repair: 'Needs repair',
  out_of_service: 'Out of service',
};

export const STATUS_BADGE: Record<string, string> = {
  available: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  in_use: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  under_maintenance: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  retired: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
  working: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  needs_repair: 'text-red-300 bg-red-500/15 border-red-500/30',
  out_of_service: 'text-red-300 bg-red-500/15 border-red-500/30',
};
