/**
 * Common aliases for smart column mapping suggestions.
 * Keys are normalized (lowercase, no spaces/underscores/punctuation).
 */
export const FIELD_ALIASES = {
  // Identity
  name: [
    'name',
    'assetname',
    'machinename',
    'equipment',
    'equipmentname',
    'itemname',
    'devicename',
    'title',
    'description',
    'asset',
  ],
  assetId: [
    'assetid',
    'assetcode',
    'assetno',
    'assetnumber',
    'itemno',
    'itemnumber',
    'itemid',
    'id',
    'code',
    'tag',
    'assettag',
    'serial',
    'barcode',
  ],
  model: ['model', 'modelno', 'modelnumber', 'modelname', 'make'],
  serialNumber: ['serialnumber', 'serialno', 'serial', 'sn', 'imei'],
  category: ['category', 'type', 'assettype', 'assetcategory', 'class'],
  groupId: ['group', 'assetgroup', 'groupname', 'assetgroupname', 'grouping'],
  status: ['status', 'state', 'conditionstatus', 'assetstatus'],
  condition: ['condition', 'health', 'quality'],
  tags: ['tags', 'labels', 'keywords'],

  // Assignment
  assignedToName: ['assignedto', 'assignedtoname', 'assignee', 'employee', 'employeename', 'user', 'username', 'owner'],
  assignedToEmployeeCode: ['employeecode', 'empcode', 'employeeno', 'staffid', 'empid'],
  locationId: ['location', 'locationname', 'site', 'sitename', 'building', 'room', 'area', 'floor'],
  departmentId: ['department', 'departmentname', 'dept', 'division', 'costcentre', 'costcenter'],

  // Purchase
  purchaseDate: [
    'purchasedate',
    'boughton',
    'acquisitiondate',
    'purchaseon',
    'datepurchased',
    'buydate',
    'procureddate',
    'invoicedate',
  ],
  warrantyExpiry: ['warrantyexpiry', 'warrantyend', 'warrantydate', 'warrantytill', 'warranty'],
  amcExpiry: ['amcexpiry', 'amcend', 'amcdate', 'amc'],
  nextMaintenanceDate: ['nextmaintenance', 'nextmaintenancedate', 'maintenancedue', 'servicedue'],
  vendorId: [
    'vendor',
    'vendorname',
    'supplier',
    'suppliername',
    'businesspartner',
    'partner',
    'partnername',
    'seller',
  ],
  cost: ['cost', 'price', 'purchasecost', 'purchaseprice', 'amount', 'value', 'unitcost', 'assetcost'],
  purchaseOrderNumber: ['po', 'ponumber', 'purchaseorder', 'purchaseordernumber'],
  invoiceNumber: ['invoicenumber', 'invoiceno', 'invoice'],
  fundingSourceId: ['fundingsource', 'funding'],
  costCenter: ['costcenter', 'costcentre', 'cc'],
};

export const STATUS_VALUE_ALIASES = {
  available: ['available', 'in stock', 'instock', 'free', 'ready', 'unused'],
  in_use: ['in use', 'inuse', 'assigned', 'allocated', 'deployed', 'active'],
  working: ['working', 'operational', 'in operation', 'inoperation', 'ok', 'good', 'running'],
  under_maintenance: ['under maintenance', 'maintenance', 'servicing', 'repair in progress'],
  needs_repair: ['needs repair', 'broken', 'faulty', 'damaged', 'defective', 'to repair'],
  out_of_service: ['out of service', 'dead', 'scrapped', 'decommissioned', 'not working', 'offline'],
  retired: ['retired', 'disposed', 'written off', 'writtenoff', 'obsolete'],
};

/** Allowed Asset.condition enum values + common spreadsheet labels */
export const ASSET_CONDITION_VALUES = [
  'excellent',
  'good',
  'fair',
  'poor',
  'critical',
  'under_maintenance',
];

export const CONDITION_VALUE_ALIASES = {
  excellent: ['excellent', 'new', 'perfect', 'mint', 'brand new', 'like new'],
  good: ['good', 'ok', 'okay', 'fine', 'normal', 'satisfactory', 'working', 'acceptable', 'pass'],
  fair: ['fair', 'average', 'okish', 'moderate', 'used', 'acceptable wear'],
  poor: ['poor', 'bad', 'worn', 'weak', 'degraded'],
  critical: ['critical', 'failing', 'severe', 'dangerous', 'urgent'],
  under_maintenance: [
    'under_maintenance',
    'under maintenance',
    'maintenance',
    'in maintenance',
    'servicing',
    'repair',
  ],
};

export function suggestConditionValue(importedValue, allowed = ASSET_CONDITION_VALUES) {
  const raw = String(importedValue || '').trim();
  if (!raw) return null;
  const norm = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  for (const cond of allowed) {
    if (cond.toLowerCase() === norm || cond.toLowerCase().replace(/_/g, ' ') === norm) {
      return cond;
    }
  }

  for (const [cond, aliases] of Object.entries(CONDITION_VALUE_ALIASES)) {
    if (!allowed.includes(cond)) continue;
    if (aliases.includes(norm)) return cond;
  }

  return null;
}

export function normalizeHeaderKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function suggestTargetField(sourceColumn, destinationFields = []) {
  const normalized = normalizeHeaderKey(sourceColumn);
  if (!normalized) return null;

  const byKey = new Map(destinationFields.map((f) => [normalizeHeaderKey(f.key), f.key]));
  const byLabel = new Map(destinationFields.map((f) => [normalizeHeaderKey(f.label), f.key]));

  if (byKey.has(normalized)) return byKey.get(normalized);
  if (byLabel.has(normalized)) return byLabel.get(normalized);

  for (const [fieldKey, aliases] of Object.entries(FIELD_ALIASES)) {
    if (!destinationFields.some((f) => f.key === fieldKey)) continue;
    if (aliases.includes(normalized)) return fieldKey;
  }

  // Fuzzy: contains
  for (const field of destinationFields) {
    const nk = normalizeHeaderKey(field.key);
    const nl = normalizeHeaderKey(field.label);
    if (normalized.includes(nk) || nk.includes(normalized) || normalized.includes(nl) || nl.includes(normalized)) {
      return field.key;
    }
  }

  return null;
}

export function suggestStatusValue(importedValue, allowedStatuses = []) {
  const raw = String(importedValue || '').trim();
  if (!raw) return null;
  const norm = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  for (const status of allowedStatuses) {
    if (status.toLowerCase() === norm || status.toLowerCase().replace(/_/g, ' ') === norm) {
      return status;
    }
  }

  for (const [status, aliases] of Object.entries(STATUS_VALUE_ALIASES)) {
    if (!allowedStatuses.includes(status)) continue;
    if (aliases.includes(norm)) return status;
  }

  return null;
}
