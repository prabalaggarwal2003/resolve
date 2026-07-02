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

export type TemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  order: number;
  section: 'basic' | 'assignment' | 'purchase' | 'custom';
  builtIn: boolean;
  options?: string[];
};

export type AssetTemplate = {
  _id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  groupId?: string | null;
  sortOrder?: number;
  fields: TemplateField[];
  statuses: string[];
  tagSuggestions: string[];
};

export const SECTION_LABELS: Record<string, string> = {
  basic: 'Basic information',
  assignment: 'Assignment & location',
  purchase: 'Purchase & warranty',
  custom: 'Additional details',
};

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

export function sortFields(fields: TemplateField[]) {
  return [...fields].sort((a, b) => a.order - b.order);
}

export function groupFieldsBySection(fields: TemplateField[]) {
  const sorted = sortFields(fields);
  const groups: { section: string; fields: TemplateField[] }[] = [];
  for (const field of sorted) {
    const section = field.section || 'basic';
    let group = groups.find((g) => g.section === section);
    if (!group) {
      group = { section, fields: [] };
      groups.push(group);
    }
    group.fields.push(field);
  }
  return groups;
}
