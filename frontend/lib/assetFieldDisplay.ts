import type { AssetTemplate, TemplateField } from '@/lib/assetTemplates';

export type DisplaySection = 'basic' | 'assignment' | 'purchase' | 'health' | 'custom' | 'system';

export type AssetFieldDef = {
  key: string;
  label: string;
  section: DisplaySection;
  kind:
    | 'text'
    | 'status'
    | 'tags'
    | 'date'
    | 'datetime'
    | 'number'
    | 'currency'
    | 'location'
    | 'department'
    | 'vendor'
    | 'user'
    | 'group';
  wide?: boolean;
  custom?: boolean;
};

export const SECTION_LABELS: Record<DisplaySection, string> = {
  basic: 'Basic information',
  assignment: 'Assignment & location',
  purchase: 'Purchase & warranty',
  health: 'Health & condition',
  custom: 'Additional details',
  system: 'Record info',
};

export const DEFAULT_ASSET_STATUSES = [
  'available',
  'in_use',
  'under_maintenance',
  'retired',
  'working',
  'needs_repair',
  'out_of_service',
];

/** All standard asset fields — shown on the info page regardless of template */
export const STANDARD_ASSET_FIELDS: AssetFieldDef[] = [
  { key: 'assetId', label: 'Asset ID', section: 'basic', kind: 'text' },
  { key: 'name', label: 'Name', section: 'basic', kind: 'text' },
  { key: 'model', label: 'Model', section: 'basic', kind: 'text' },
  { key: 'serialNumber', label: 'Serial number', section: 'basic', kind: 'text' },
  { key: 'category', label: 'Category', section: 'basic', kind: 'text' },
  { key: 'groupId', label: 'Asset group', section: 'basic', kind: 'group' },
  { key: 'status', label: 'Status', section: 'basic', kind: 'status', wide: true },
  { key: 'tags', label: 'Tags', section: 'basic', kind: 'tags', wide: true },
  { key: 'assignedToName', label: 'Assigned to (name)', section: 'assignment', kind: 'text' },
  { key: 'assignedToEmployeeCode', label: 'Employee code', section: 'assignment', kind: 'text' },
  { key: 'assignedTo', label: 'Assigned user', section: 'assignment', kind: 'user' },
  { key: 'assignedAt', label: 'Assigned at', section: 'assignment', kind: 'datetime' },
  { key: 'locationId', label: 'Location', section: 'assignment', kind: 'location' },
  { key: 'departmentId', label: 'Department', section: 'assignment', kind: 'department' },
  { key: 'purchaseDate', label: 'Purchase date', section: 'purchase', kind: 'date' },
  { key: 'warrantyExpiry', label: 'Warranty expiry', section: 'purchase', kind: 'date' },
  { key: 'amcExpiry', label: 'AMC expiry', section: 'purchase', kind: 'date' },
  { key: 'nextMaintenanceDate', label: 'Next maintenance', section: 'purchase', kind: 'date' },
  { key: 'vendorId', label: 'Vendor', section: 'purchase', kind: 'vendor' },
  { key: 'cost', label: 'Cost (INR)', section: 'purchase', kind: 'currency' },
  { key: 'condition', label: 'Condition', section: 'health', kind: 'text' },
  { key: 'lastHealthCheck', label: 'Last health check', section: 'health', kind: 'datetime' },
  { key: 'createdAt', label: 'Date added', section: 'system', kind: 'datetime' },
  { key: 'updatedAt', label: 'Last updated', section: 'system', kind: 'datetime' },
];

const SKIP_KEYS = new Set([
  '_id',
  '__v',
  'organizationId',
  'templateId',
  'createdBy',
  'updatedBy',
  'purchaseInvoiceId',
  'qrCodeUrl',
  'photos',
  'documents',
  'maintenanceHistory',
  'maintenanceReason',
  'maintenanceStartDate',
  'maintenanceCompletedDate',
  'customFields',
]);

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferCustomKind(value: unknown): AssetFieldDef['kind'] {
  if (Array.isArray(value)) return 'tags';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
  return 'text';
}

export function getAssetDisplayFields(asset: Record<string, unknown>): AssetFieldDef[] {
  const customFields = (asset.customFields as Record<string, unknown>) || {};
  const standardKeys = new Set(STANDARD_ASSET_FIELDS.map((f) => f.key));
  const customDefs: AssetFieldDef[] = Object.keys(customFields)
    .sort()
    .map((key) => ({
      key: `custom:${key}`,
      label: humanizeKey(key),
      section: 'custom' as const,
      kind: inferCustomKind(customFields[key]),
      wide: Array.isArray(customFields[key]) && (customFields[key] as unknown[]).length > 2,
      custom: true,
    }));

  const extraDefs: AssetFieldDef[] = [];
  for (const key of Object.keys(asset)) {
    if (SKIP_KEYS.has(key) || standardKeys.has(key) || key in customFields) continue;
    const val = asset[key];
    if (val === null || val === undefined || val === '') continue;
    if (typeof val === 'object' && !Array.isArray(val) && !('_id' in (val as object))) continue;
    extraDefs.push({
      key,
      label: humanizeKey(key),
      section: 'custom',
      kind: inferCustomKind(val),
      wide: Array.isArray(val),
    });
  }

  return [...STANDARD_ASSET_FIELDS, ...customDefs, ...extraDefs.sort((a, b) => a.label.localeCompare(b.label))];
}

export function getFieldRawValue(asset: Record<string, unknown>, field: AssetFieldDef): unknown {
  if (field.custom) {
    const customKey = field.key.replace(/^custom:/, '');
    return (asset.customFields as Record<string, unknown> | undefined)?.[customKey];
  }
  return asset[field.key];
}

export function buildFallbackTemplateFromAsset(asset: Record<string, unknown>): AssetTemplate {
  const customFields = (asset.customFields as Record<string, unknown>) || {};
  const customTemplateFields: TemplateField[] = Object.keys(customFields)
    .sort()
    .map((key, i) => {
      const val = customFields[key];
      let type: TemplateField['type'] = 'text';
      if (Array.isArray(val)) type = 'checkbox';
      else if (typeof val === 'number') type = 'number';
      else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) type = 'date';
      return {
        key,
        label: humanizeKey(key),
        type,
        required: false,
        order: 100 + i,
        section: 'custom' as const,
        builtIn: false,
        options: Array.isArray(val) ? val.map(String) : [],
      };
    });

  const builtIn: TemplateField[] = [
    { key: 'name', label: 'Name', type: 'text', required: true, order: 1, section: 'basic', builtIn: true },
    { key: 'model', label: 'Model', type: 'text', required: false, order: 2, section: 'basic', builtIn: true },
    { key: 'serialNumber', label: 'Serial number', type: 'text', required: false, order: 3, section: 'basic', builtIn: true },
    { key: 'status', label: 'Status', type: 'status', required: false, order: 4, section: 'basic', builtIn: true },
    { key: 'tags', label: 'Tags', type: 'tags', required: false, order: 5, section: 'basic', builtIn: true },
    { key: 'assignedToName', label: 'Assigned to (name)', type: 'text', required: false, order: 20, section: 'assignment', builtIn: true },
    { key: 'assignedToEmployeeCode', label: 'Employee code', type: 'text', required: false, order: 21, section: 'assignment', builtIn: true },
    { key: 'locationId', label: 'Location', type: 'location', required: false, order: 22, section: 'assignment', builtIn: true },
    { key: 'departmentId', label: 'Department', type: 'select', required: false, order: 23, section: 'assignment', builtIn: true },
    { key: 'purchaseDate', label: 'Purchase date', type: 'date', required: false, order: 30, section: 'purchase', builtIn: true },
    { key: 'warrantyExpiry', label: 'Warranty expiry', type: 'date', required: false, order: 31, section: 'purchase', builtIn: true },
    { key: 'amcExpiry', label: 'AMC expiry', type: 'date', required: false, order: 32, section: 'purchase', builtIn: true },
    { key: 'nextMaintenanceDate', label: 'Next maintenance', type: 'date', required: false, order: 33, section: 'purchase', builtIn: true },
    { key: 'vendorId', label: 'Vendor', type: 'select', required: false, order: 34, section: 'purchase', builtIn: true },
    { key: 'cost', label: 'Cost (INR)', type: 'number', required: false, order: 35, section: 'purchase', builtIn: true },
  ];

  return {
    _id: 'fallback',
    name: String(asset.category || 'Asset'),
    fields: [...builtIn, ...customTemplateFields],
    statuses: DEFAULT_ASSET_STATUSES,
    tagSuggestions: Array.isArray(asset.tags) ? (asset.tags as string[]) : [],
  };
}

export function groupDisplayFieldsBySection(fields: AssetFieldDef[]) {
  const order: DisplaySection[] = ['basic', 'assignment', 'purchase', 'health', 'custom', 'system'];
  const groups: { section: DisplaySection; fields: AssetFieldDef[] }[] = [];
  for (const section of order) {
    const sectionFields = fields.filter((f) => f.section === section);
    if (sectionFields.length) groups.push({ section, fields: sectionFields });
  }
  return groups;
}
