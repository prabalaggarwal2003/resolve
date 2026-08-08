import {
  AssetTemplate,
  AssetGroup,
  Location,
  Department,
  BusinessPartner,
  User,
} from '../../models/index.js';
import { getBusinessPartnerOrgConfig } from '../businessPartnerOrgConfigService.js';
import { DEFAULT_ASSET_STATUSES, BUILTIN_FIELD_KEYS } from '../../constants/assetTemplateDefaults.js';
import { ensureDefaultAssetGroups } from '../assetGroupService.js';

/** Section order for import destination field pickers */
export const IMPORT_FIELD_SECTIONS = [
  { key: 'basic', label: 'Basic info' },
  { key: 'assignment', label: 'Assignment & location' },
  { key: 'purchase', label: 'Purchase & finance' },
  { key: 'custom', label: 'Additional details' },
];

/**
 * Full set of Resolve asset fields available for import mapping.
 * Not limited to a single asset template/category.
 */
const STANDARD_IMPORT_FIELDS = [
  {
    key: 'assetId',
    label: 'Asset ID',
    type: 'text',
    required: false,
    section: 'basic',
    builtIn: true,
  },
  {
    key: 'name',
    label: 'Asset Name',
    type: 'text',
    required: true,
    section: 'basic',
    builtIn: true,
  },
  {
    key: 'category',
    label: 'Category',
    type: 'text',
    required: false,
    section: 'basic',
    builtIn: true,
  },
  {
    key: 'groupId',
    label: 'Asset group',
    type: 'select',
    required: false,
    section: 'basic',
    builtIn: true,
    relationship: 'group',
  },
  {
    key: 'model',
    label: 'Model',
    type: 'text',
    required: false,
    section: 'basic',
    builtIn: true,
  },
  {
    key: 'serialNumber',
    label: 'Serial number',
    type: 'text',
    required: false,
    section: 'basic',
    builtIn: true,
  },
  {
    key: 'status',
    label: 'Status',
    type: 'status',
    required: false,
    section: 'basic',
    builtIn: true,
  },
  {
    key: 'condition',
    label: 'Condition',
    type: 'select',
    required: false,
    section: 'basic',
    builtIn: true,
    options: ['excellent', 'good', 'fair', 'poor', 'critical', 'under_maintenance'],
  },
  {
    key: 'tags',
    label: 'Tags',
    type: 'tags',
    required: false,
    section: 'basic',
    builtIn: true,
  },
  {
    key: 'assignedToName',
    label: 'Assigned to (name)',
    type: 'text',
    required: false,
    section: 'assignment',
    builtIn: true,
  },
  {
    key: 'assignedToEmployeeCode',
    label: 'Employee code',
    type: 'text',
    required: false,
    section: 'assignment',
    builtIn: true,
  },
  {
    key: 'assignedTo',
    label: 'Assigned user (account)',
    type: 'select',
    required: false,
    section: 'assignment',
    builtIn: true,
    relationship: 'user',
  },
  {
    key: 'locationId',
    label: 'Location',
    type: 'location',
    required: false,
    section: 'assignment',
    builtIn: true,
    relationship: 'location',
  },
  {
    key: 'departmentId',
    label: 'Department',
    type: 'select',
    required: false,
    section: 'assignment',
    builtIn: true,
    relationship: 'department',
  },
  {
    key: 'purchaseDate',
    label: 'Purchase date',
    type: 'date',
    required: false,
    section: 'purchase',
    builtIn: true,
  },
  {
    key: 'warrantyExpiry',
    label: 'Warranty expiry',
    type: 'date',
    required: false,
    section: 'purchase',
    builtIn: true,
  },
  {
    key: 'amcExpiry',
    label: 'AMC / insurance expiry',
    type: 'date',
    required: false,
    section: 'purchase',
    builtIn: true,
  },
  {
    key: 'nextMaintenanceDate',
    label: 'Next maintenance date',
    type: 'date',
    required: false,
    section: 'purchase',
    builtIn: true,
  },
  {
    key: 'vendorId',
    label: 'Partner / vendor',
    type: 'select',
    required: false,
    section: 'purchase',
    builtIn: true,
    relationship: 'partner',
  },
  {
    key: 'relationshipTypeKey',
    label: 'Partner relationship',
    type: 'select',
    required: false,
    section: 'purchase',
    builtIn: true,
  },
  {
    key: 'cost',
    label: 'Cost',
    type: 'number',
    required: false,
    section: 'purchase',
    builtIn: true,
  },
  {
    key: 'purchaseOrderNumber',
    label: 'PO number',
    type: 'text',
    required: false,
    section: 'purchase',
    builtIn: true,
  },
  {
    key: 'invoiceNumber',
    label: 'Invoice number',
    type: 'text',
    required: false,
    section: 'purchase',
    builtIn: true,
  },
  {
    key: 'costCenter',
    label: 'Cost center',
    type: 'text',
    required: false,
    section: 'purchase',
    builtIn: true,
  },
  {
    key: 'fundingSourceId',
    label: 'Funding source',
    type: 'text',
    required: false,
    section: 'purchase',
    builtIn: true,
  },
];

function relationshipForField(f) {
  if (f.relationship) return f.relationship;
  if (f.key === 'locationId' || f.type === 'location') return 'location';
  if (f.key === 'departmentId') return 'department';
  if (f.key === 'vendorId' || f.key === 'partnerId') return 'partner';
  if (f.key === 'assignedTo') return 'user';
  if (f.key === 'groupId') return 'group';
  return null;
}

function normalizeSection(key, section, builtIn) {
  if (!builtIn && !BUILTIN_FIELD_KEYS.has(key)) return 'custom';
  if (section && IMPORT_FIELD_SECTIONS.some((s) => s.key === section)) return section;
  const byKey = STANDARD_IMPORT_FIELDS.find((f) => f.key === key);
  return byKey?.section || 'custom';
}

/**
 * Build destination field catalog from all standard asset fields + every
 * custom field across the org’s templates (not limited to one category).
 */
export async function getAssetImportCatalog(organizationId, templateId) {
  let template = null;
  if (templateId) {
    template = await AssetTemplate.findOne({ _id: templateId, organizationId }).lean();
  }
  if (!template) {
    template = await AssetTemplate.findOne({ organizationId, isDefault: true }).lean();
  }
  if (!template) {
    template = await AssetTemplate.findOne({ organizationId }).sort({ sortOrder: 1, name: 1 }).lean();
  }

  const allTemplates = await AssetTemplate.find({ organizationId })
    .select('_id name fields statuses')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const fields = [];
  const RELATIONSHIP_KEYS = new Set([
    'locationId',
    'departmentId',
    'vendorId',
    'partnerId',
    'assignedTo',
    'groupId',
  ]);
  const pushField = (field) => {
    if (!field?.key) return;
    const relationship = relationshipForField(field);
    const options =
      RELATIONSHIP_KEYS.has(field.key) || relationship
        ? [] // relationship fields resolve against entities, not option lists
        : Array.isArray(field.options)
          ? field.options
          : [];
    const existing = fields.find((f) => f.key === field.key);
    if (existing) {
      if ((!existing.options || !existing.options.length) && options.length) {
        existing.options = options;
      }
      if (field.required && field.key === 'name') existing.required = true;
      return;
    }
    fields.push({
      key: field.key,
      label: field.label || field.key,
      type: field.type || 'text',
      required: Boolean(field.required) || field.key === 'name',
      section: normalizeSection(field.key, field.section, field.builtIn),
      builtIn: Boolean(field.builtIn) || BUILTIN_FIELD_KEYS.has(field.key),
      options,
      relationship,
    });
  };

  for (const f of STANDARD_IMPORT_FIELDS) {
    pushField(f);
  }

  // Union custom (+ any extra) fields from every template in the org
  for (const tpl of allTemplates) {
    for (const f of tpl.fields || []) {
      if (!f?.key) continue;
      const isBuiltIn = Boolean(f.builtIn) || BUILTIN_FIELD_KEYS.has(f.key) || STANDARD_IMPORT_FIELDS.some((s) => s.key === f.key);
      if (isBuiltIn) {
        // Refresh label/options from templates when useful
        pushField({
          ...f,
          builtIn: true,
          section: normalizeSection(f.key, f.section, true),
          required: f.key === 'name' ? true : false,
        });
        continue;
      }
      pushField({
        key: f.key,
        label: f.label || f.key,
        type: f.type || 'text',
        required: false,
        section: 'custom',
        builtIn: false,
        options: Array.isArray(f.options) ? f.options : [],
      });
    }
  }

  const statusSet = new Set(DEFAULT_ASSET_STATUSES);
  for (const tpl of allTemplates) {
    for (const s of tpl.statuses || []) statusSet.add(s);
  }
  const statuses = [...statusSet];

  const statusField = fields.find((f) => f.key === 'status');
  if (statusField) statusField.options = statuses;

  const relField = fields.find((f) => f.key === 'relationshipTypeKey');

  // Stable section order, then label
  const sectionOrder = Object.fromEntries(IMPORT_FIELD_SECTIONS.map((s, i) => [s.key, i]));
  fields.sort((a, b) => {
    const sa = sectionOrder[a.section] ?? 99;
    const sb = sectionOrder[b.section] ?? 99;
    if (sa !== sb) return sa - sb;
    return String(a.label).localeCompare(String(b.label));
  });

  const [locations, departments, partners, users, partnerConfig, groups] = await Promise.all([
      Location.find({ organizationId }).select('_id name path code type').sort({ name: 1 }).lean(),
      Department.find({ organizationId }).select('_id name').sort({ name: 1 }).lean(),
      BusinessPartner.find({ organizationId })
        .select('_id name partnerCode status')
        .sort({ name: 1 })
        .limit(5000)
        .lean(),
      User.find({ organizationId }).select('_id name email').sort({ name: 1 }).lean(),
      getBusinessPartnerOrgConfig(organizationId),
      ensureDefaultAssetGroups(organizationId, null).then((list) =>
        list?.length
          ? list
          : AssetGroup.find({ organizationId }).sort({ order: 1, name: 1 }).lean()
      ),
    ]);

  // Categories for step 4 = existing asset template names only
  const categorySet = new Map(); // lower -> canonical display
  for (const tpl of allTemplates) {
    const name = String(tpl.name || '').trim();
    if (name) categorySet.set(name.toLowerCase(), name);
  }
  const categories = [...categorySet.values()].sort((a, b) => a.localeCompare(b));

  const categoryField = fields.find((f) => f.key === 'category');
  if (categoryField) {
    categoryField.options = categories;
    categoryField.type = 'select';
  }

  if (relField) {
    relField.options = (partnerConfig?.assetRelationshipTypes || []).map((t) => t.key);
  }

  return {
    template: template
      ? {
          _id: String(template._id),
          name: template.name,
          statuses,
          fields: template.fields || [],
        }
      : null,
    sections: IMPORT_FIELD_SECTIONS,
    destinationFields: fields,
    entities: {
      locations: locations.map((l) => ({
        id: String(l._id),
        name: l.name,
        path: l.path || l.name,
        code: l.code || '',
      })),
      departments: departments.map((d) => ({ id: String(d._id), name: d.name })),
      partners: partners.map((p) => ({
        id: String(p._id),
        name: p.name,
        code: p.partnerCode || '',
        status: p.status || '',
      })),
      users: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email || '' })),
      groups: (groups || []).map((g) => ({
        id: String(g._id),
        name: g.name,
        key: g.key || '',
      })),
      categories,
      statuses,
      relationshipTypes: (partnerConfig?.assetRelationshipTypes || []).map((t) => ({
        key: t.key,
        label: t.label,
      })),
    },
  };
}
