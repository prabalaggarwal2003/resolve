/** Default asset statuses — templates may add custom ones */
export const DEFAULT_ASSET_STATUSES = [
  'available',
  'in_use',
  'under_maintenance',
  'retired',
  'working',
  'needs_repair',
  'out_of_service',
];

const SECTION = {
  BASIC: 'basic',
  ASSIGNMENT: 'assignment',
  PURCHASE: 'purchase',
};

function f(key, label, type, { required = false, order, section = SECTION.BASIC, options } = {}) {
  return { key, label, type, required, order, section, builtIn: true, options: options || [] };
}

function custom(key, label, type, { required = false, order, section = SECTION.BASIC, options } = {}) {
  return { key, label, type, required, order, section, builtIn: false, options: options || [] };
}

const COMMON_ASSIGNMENT = [
  f('assignedToName', 'Assigned to (name)', 'text', { order: 20, section: SECTION.ASSIGNMENT }),
  f('assignedToEmployeeCode', 'Employee code', 'text', { order: 21, section: SECTION.ASSIGNMENT }),
  f('locationId', 'Location', 'location', { order: 22, section: SECTION.ASSIGNMENT }),
  f('departmentId', 'Department', 'select', { order: 23, section: SECTION.ASSIGNMENT }),
];

const COMMON_PURCHASE = [
  f('purchaseDate', 'Purchase date', 'date', { order: 30, section: SECTION.PURCHASE }),
  f('warrantyExpiry', 'Warranty expiry', 'date', { order: 31, section: SECTION.PURCHASE }),
  f('vendorId', 'Vendor', 'select', { order: 32, section: SECTION.PURCHASE }),
  f('cost', 'Cost (INR)', 'number', { order: 33, section: SECTION.PURCHASE }),
];

function baseFields(extraBasic = []) {
  return [
    f('name', 'Name', 'text', { required: true, order: 1 }),
    f('model', 'Model', 'text', { order: 2 }),
    f('serialNumber', 'Serial number', 'text', { order: 3 }),
    f('status', 'Status', 'status', { order: 4 }),
    f('tags', 'Tags', 'tags', { order: 5 }),
    ...extraBasic,
    ...COMMON_ASSIGNMENT,
    ...COMMON_PURCHASE,
  ];
}

export const DEFAULT_ASSET_TEMPLATES = [
  {
    name: 'Laptop',
    description: 'Portable computers and notebooks',
    tagSuggestions: ['IT', 'Portable', 'End-user'],
    statuses: [...DEFAULT_ASSET_STATUSES],
    fields: baseFields([
      custom('ram', 'RAM', 'text', { order: 10 }),
      custom('storage', 'Storage', 'text', { order: 11 }),
      custom('processor', 'Processor', 'text', { order: 12 }),
    ]),
  },
  {
    name: 'Desktop',
    description: 'Fixed workstations and PCs',
    tagSuggestions: ['IT', 'Workstation', 'Office'],
    statuses: [...DEFAULT_ASSET_STATUSES],
    fields: baseFields([
      custom('ram', 'RAM', 'text', { order: 10 }),
      custom('storage', 'Storage', 'text', { order: 11 }),
      custom('processor', 'Processor', 'text', { order: 12 }),
      custom('formFactor', 'Form factor', 'select', { order: 13, options: ['Tower', 'SFF', 'AIO'] }),
    ]),
  },
  {
    name: 'Printer',
    description: 'Printers and multifunction devices',
    tagSuggestions: ['Peripheral', 'Office', 'Consumables'],
    statuses: [...DEFAULT_ASSET_STATUSES, 'low_toner'],
    fields: baseFields([
      custom('printType', 'Print type', 'select', { order: 10, options: ['Laser', 'Inkjet', 'Thermal', 'Dot matrix'] }),
      custom('connectivity', 'Connectivity', 'text', { order: 11 }),
    ]),
  },
  {
    name: 'Projector',
    description: 'Classroom and meeting room projectors',
    tagSuggestions: ['AV', 'Classroom', 'Presentation'],
    statuses: [...DEFAULT_ASSET_STATUSES, 'lamp_due'],
    fields: baseFields([
      custom('lumens', 'Brightness (lumens)', 'number', { order: 10 }),
      custom('resolution', 'Resolution', 'text', { order: 11 }),
      custom('throwType', 'Throw type', 'select', { order: 12, options: ['Short throw', 'Standard', 'Long throw'] }),
    ]),
  },
  {
    name: 'Router',
    description: 'Network routers and gateways',
    tagSuggestions: ['Network', 'IT', 'Infrastructure'],
    statuses: [...DEFAULT_ASSET_STATUSES, 'degraded'],
    fields: baseFields([
      custom('ipAddress', 'IP address', 'text', { order: 10 }),
      custom('macAddress', 'MAC address', 'text', { order: 11 }),
      custom('firmwareVersion', 'Firmware version', 'text', { order: 12 }),
      custom('ports', 'Ports', 'number', { order: 13 }),
    ]),
  },
  {
    name: 'Vehicle',
    description: 'Institutional vehicles',
    tagSuggestions: ['Transport', 'Fleet'],
    statuses: [...DEFAULT_ASSET_STATUSES, 'in_service', 'off_road'],
    fields: baseFields([
      custom('registrationNumber', 'Registration number', 'text', { required: true, order: 10 }),
      custom('fuelType', 'Fuel type', 'select', { order: 11, options: ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'] }),
      custom('odometer', 'Odometer (km)', 'number', { order: 12 }),
      f('amcExpiry', 'Insurance / AMC expiry', 'date', { order: 34, section: SECTION.PURCHASE }),
    ]),
  },
  {
    name: 'Furniture',
    description: 'Desks, chairs, cabinets, and fixtures',
    tagSuggestions: ['Facilities', 'Office', 'Classroom'],
    statuses: [...DEFAULT_ASSET_STATUSES, 'damaged'],
    fields: baseFields([
      custom('material', 'Material', 'text', { order: 10 }),
      custom('dimensions', 'Dimensions', 'text', { order: 11 }),
      custom('color', 'Color', 'text', { order: 12 }),
    ]),
  },
  {
    name: 'Air Conditioner',
    description: 'HVAC and air conditioning units',
    tagSuggestions: ['Facilities', 'HVAC', 'Maintenance'],
    statuses: [...DEFAULT_ASSET_STATUSES, 'service_due', 'gas_refill_due'],
    fields: baseFields([
      custom('tonnage', 'Tonnage', 'number', { order: 10 }),
      custom('btu', 'BTU rating', 'number', { order: 11 }),
      custom('refrigerant', 'Refrigerant type', 'text', { order: 12 }),
      f('amcExpiry', 'AMC expiry', 'date', { order: 34, section: SECTION.PURCHASE }),
      f('nextMaintenanceDate', 'Next service date', 'date', { order: 35, section: SECTION.PURCHASE }),
    ]),
  },
];

export const BUILTIN_FIELD_KEYS = new Set([
  'name',
  'model',
  'serialNumber',
  'status',
  'tags',
  'assignedToName',
  'assignedToEmployeeCode',
  'locationId',
  'departmentId',
  'purchaseDate',
  'warrantyExpiry',
  'vendorId',
  'cost',
  'amcExpiry',
  'nextMaintenanceDate',
]);

export const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'textarea',
  'checkbox',
  'radio',
  'status',
  'tags',
  'location',
];

/** Shown in template editor when configuring custom fields */
export const TEMPLATE_EDITOR_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'textarea',
  'checkbox',
  'radio',
];
