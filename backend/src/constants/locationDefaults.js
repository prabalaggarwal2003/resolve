export const DEFAULT_LOCATION_TYPES = [
  { key: 'campus', name: 'Campus', icon: '🏫', color: '#3b82f6', order: 1 },
  { key: 'building', name: 'Building', icon: '🏢', color: '#8b5cf6', order: 2 },
  { key: 'floor', name: 'Floor', icon: '🏬', color: '#f59e0b', order: 3 },
  { key: 'room', name: 'Room', icon: '🚪', color: '#10b981', order: 4 },
  { key: 'office', name: 'Office', icon: '🏛️', color: '#06b6d4', order: 5 },
  { key: 'lab', name: 'Lab', icon: '🔬', color: '#ec4899', order: 6 },
  { key: 'warehouse', name: 'Warehouse', icon: '📦', color: '#f97316', order: 7 },
  { key: 'store', name: 'Store', icon: '🏪', color: '#84cc16', order: 8 },
  { key: 'department', name: 'Department', icon: '🏷️', color: '#6366f1', order: 9 },
];

/** Quick-setup templates — each level is a location type key */
export const LOCATION_TEMPLATES = {
  college: {
    name: 'College',
    description: 'Campus → Buildings → Floors → Rooms & Labs',
    rootType: 'campus',
    skeleton: [
      { type: 'building', name: 'Building A' },
      { type: 'floor', name: 'Floor 1' },
      { type: 'room', name: 'Room 101' },
      { type: 'lab', name: 'Lab 1' },
    ],
  },
  office: {
    name: 'Office',
    description: 'Head office → Departments → Cabins → Meeting rooms',
    rootType: 'office',
    skeleton: [
      { type: 'department', name: 'Department 1' },
      { type: 'room', name: 'Cabin 1' },
      { type: 'room', name: 'Meeting Room 1' },
    ],
  },
  warehouse: {
    name: 'Warehouse',
    description: 'Warehouse → Sections → Shelves → Bins',
    rootType: 'warehouse',
    skeleton: [
      { type: 'department', name: 'Section A' },
      { type: 'store', name: 'Shelf 1' },
      { type: 'room', name: 'Bin 1' },
    ],
  },
  hospital: {
    name: 'Hospital',
    description: 'Hospital → Blocks → Floors → Wards → Rooms',
    rootType: 'campus',
    skeleton: [
      { type: 'building', name: 'Block A' },
      { type: 'floor', name: 'Floor 1' },
      { type: 'department', name: 'Ward 1' },
      { type: 'room', name: 'Room 101' },
    ],
  },
};
