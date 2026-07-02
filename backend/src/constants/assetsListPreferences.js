export const DEFAULT_ASSET_TABLE_COLUMNS = [
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

export function getDefaultAssetsListPreferences() {
  return {
    columns: DEFAULT_ASSET_TABLE_COLUMNS.map((c) => ({ ...c })),
    savedViews: [],
    activeViewId: null,
    sort: 'createdAt',
    order: 'desc',
    pageSize: 25,
    globalSearch: '',
    advancedFilters: [],
    basicFilters: {
      status: '',
      category: '',
      groupId: '',
      departmentId: '',
      locationIds: [],
      locationIncludeChildren: true,
    },
  };
}
