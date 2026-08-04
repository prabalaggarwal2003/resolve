export type TemplateFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'status'
  | 'tags'
  | 'location';

export type TemplateSection = 'basic' | 'assignment' | 'purchase' | 'custom';

export type TemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  order: number;
  section: TemplateSection;
  builtIn: boolean;
  /** Show on QR scan when the parent section is enabled */
  qrVisible?: boolean;
  options?: string[];
};

export type TemplateQrSections = {
  basic: boolean;
  assignment: boolean;
  purchase: boolean;
  custom: boolean;
  photos: boolean;
  documents: boolean;
  maintenance: boolean;
  issues: boolean;
};

export type AssetTemplate = {
  _id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  groupId?: string | null;
  sortOrder?: number;
  fields: TemplateField[];
  qrSections?: Partial<TemplateQrSections>;
  statuses: string[];
  tagSuggestions: string[];
};

export const SECTION_ORDER: TemplateSection[] = ['basic', 'assignment', 'purchase', 'custom'];

export const SECTION_LABELS: Record<TemplateSection, string> = {
  basic: 'Basic information',
  assignment: 'Assignment & location',
  purchase: 'Purchase & warranty',
  custom: 'Additional details',
};

export const QR_EXTRA_SECTIONS: { key: keyof TemplateQrSections; label: string; hint: string }[] = [
  { key: 'photos', label: 'Photos', hint: 'Show asset photos on the QR page' },
  { key: 'documents', label: 'Documents', hint: 'Show downloadable documents' },
  { key: 'maintenance', label: 'Maintenance', hint: 'Show maintenance history and status' },
  { key: 'issues', label: 'Previous issues', hint: 'Show past issues for this asset' },
];

export const DEFAULT_QR_SECTIONS: TemplateQrSections = {
  basic: true,
  assignment: true,
  purchase: true,
  custom: true,
  photos: true,
  documents: true,
  maintenance: true,
  issues: true,
};

export function normalizeQrSections(input?: Partial<TemplateQrSections> | null): TemplateQrSections {
  return {
    basic: input?.basic !== false,
    assignment: input?.assignment !== false,
    purchase: input?.purchase !== false,
    custom: input?.custom !== false,
    photos: input?.photos !== false,
    documents: input?.documents !== false,
    maintenance: input?.maintenance !== false,
    issues: input?.issues !== false,
  };
}

export const FIELD_TYPE_LABELS: Record<TemplateFieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown',
  textarea: 'Long text',
  checkbox: 'Checkbox',
  radio: 'Radio button',
  status: 'Status',
  tags: 'Tags',
  location: 'Location hierarchy',
};

/** Types available when adding/editing custom fields in the template editor */
export const TEMPLATE_EDITOR_FIELD_TYPES: TemplateFieldType[] = [
  'text',
  'number',
  'date',
  'select',
  'textarea',
  'checkbox',
  'radio',
];

export function fieldTypeNeedsOptions(type: TemplateFieldType) {
  return type === 'select' || type === 'checkbox' || type === 'radio';
}

/** Same section map as the asset info page for built-in fields. */
export const BUILTIN_SECTION_BY_KEY: Record<string, TemplateSection> = {
  name: 'basic',
  model: 'basic',
  serialNumber: 'basic',
  status: 'basic',
  tags: 'basic',
  condition: 'basic',
  assignedToName: 'assignment',
  assignedToEmployeeCode: 'assignment',
  locationId: 'assignment',
  departmentId: 'assignment',
  purchaseDate: 'purchase',
  warrantyExpiry: 'purchase',
  amcExpiry: 'purchase',
  nextMaintenanceDate: 'purchase',
  vendorId: 'purchase',
  cost: 'purchase',
  budgetId: 'purchase',
  procurementId: 'purchase',
  fundingSourceId: 'purchase',
  costCenter: 'purchase',
  purchaseOrderNumber: 'purchase',
  invoiceNumber: 'purchase',
};

/**
 * Align a field's section with asset info:
 * - built-in fields → fixed asset-info section
 * - custom fields → Additional details (`custom`)
 */
export function resolveTemplateFieldSection(field: Pick<TemplateField, 'key' | 'section' | 'builtIn'>): TemplateSection {
  if (field.builtIn || BUILTIN_SECTION_BY_KEY[field.key]) {
    return BUILTIN_SECTION_BY_KEY[field.key] || (field.section as TemplateSection) || 'basic';
  }
  return 'custom';
}

/** Normalize all template fields to asset-info section layout. */
export function normalizeTemplateFieldSections(fields: TemplateField[]): TemplateField[] {
  return fields.map((field) => ({
    ...field,
    section: resolveTemplateFieldSection(field),
    // Treat unknown keys as custom (matches asset info Additional details)
    builtIn: Boolean(field.builtIn || BUILTIN_SECTION_BY_KEY[field.key]),
  }));
}

export function sortFields(fields: TemplateField[]) {
  return [...fields].sort((a, b) => a.order - b.order);
}

export function groupFieldsBySection(fields: TemplateField[]) {
  const sorted = sortFields(normalizeTemplateFieldSections(fields));
  const groups: { section: TemplateSection; fields: TemplateField[] }[] = [];
  for (const section of SECTION_ORDER) {
    groups.push({ section, fields: [] });
  }
  for (const field of sorted) {
    const section = field.section || 'custom';
    const group = groups.find((g) => g.section === section) || groups[groups.length - 1];
    group.fields.push(field);
  }
  return groups;
}
