import { Asset, Invoice } from '../models/index.js';
import PartnerContract from '../models/PartnerContract.js';

export const PARTNER_FIELD_LABELS = {
  name: 'Name',
  partnerCode: 'Partner Code',
  partnerTypeKey: 'Partner Type',
  categoryKey: 'Category',
  status: 'Status',
  email: 'Email',
  phone: 'Phone',
  website: 'Website',
  taxId: 'Tax ID',
  notes: 'Notes',
  paymentTerms: 'Payment Terms',
  creditLimit: 'Credit Limit',
  currency: 'Currency',
  registrationDetails: 'Registration Details',
  businessDetails: 'Business Details',
  bankDetails: 'Bank Details',
  taxDetails: 'Tax Details',
  paymentDetails: 'Payment Details',
  primaryContact: 'Primary Contact',
  contacts: 'Contacts',
  addresses: 'Addresses',
  tags: 'Tags',
  customFields: 'Custom Fields',
};

const NESTED_OBJECT_FIELDS = new Set([
  'registrationDetails',
  'businessDetails',
  'bankDetails',
  'taxDetails',
  'paymentDetails',
  'primaryContact',
  'customFields',
]);

/** Match rows linked either through partnerId, legacy vendorId, or partnerRelationships. */
export function partnerLinkQuery(partnerId, organizationId) {
  const query = {
    $or: [
      { partnerId },
      { vendorId: partnerId },
      { 'partnerRelationships.partnerId': partnerId },
    ],
  };
  if (organizationId) query.organizationId = organizationId;
  return query;
}

function toPlain(value) {
  if (value == null) return value;
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
}

function isPlainObject(value) {
  const plain = toPlain(value);
  return plain != null && typeof plain === 'object' && !Array.isArray(plain) && !(plain instanceof Date);
}

function normalizeValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    return JSON.stringify(toPlain(value));
  }
  return String(value);
}

function displayValue(value) {
  if (value == null || value === '') return '(empty)';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const plain = toPlain(value);
    return Array.isArray(plain) ? `${plain.length} item(s)` : JSON.stringify(plain);
  }
  return String(value);
}

function humanizeKey(key) {
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/** Field-level diff used for audit trails and activity feeds. */
export function diffPartnerFields(prev = {}, next = {}) {
  const changes = [];
  for (const [field, label] of Object.entries(PARTNER_FIELD_LABELS)) {
    if (!(field in next)) continue;

    if (NESTED_OBJECT_FIELDS.has(field) && (isPlainObject(prev[field]) || isPlainObject(next[field]))) {
      const prevObj = toPlain(prev[field]) || {};
      const nextObj = toPlain(next[field]) || {};
      const keys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
      for (const key of keys) {
        const before = normalizeValue(prevObj[key]);
        const after = normalizeValue(nextObj[key]);
        if (before === after) continue;
        changes.push({
          field: `${field}.${key}`,
          label: `${label} · ${humanizeKey(key)}`,
          from: displayValue(prevObj[key]),
          to: displayValue(nextObj[key]),
        });
      }
      continue;
    }

    const before = normalizeValue(prev[field]);
    const after = normalizeValue(next[field]);
    if (before === after) continue;
    changes.push({
      field,
      label,
      from: displayValue(prev[field]),
      to: displayValue(next[field]),
    });
  }
  return changes;
}

export function formatPartnerFieldChangesSummary(partnerName, changes = []) {
  const name = partnerName || 'Partner';
  if (!changes.length) return `${name}: updated`;
  const parts = changes.map((c) => `${c.label}: ${c.from ?? c.oldValue} → ${c.to ?? c.newValue}`);
  const joined = parts.join('; ');
  if (joined.length <= 280) return `${name}: ${joined}`;
  return `${name}: ${changes.map((c) => c.label).join(', ')} updated`;
}

/** Convert partner activity-style changes ({ from, to }) into audit fieldChanges ({ oldValue, newValue }). */
export function toAuditFieldChanges(changes = []) {
  return (Array.isArray(changes) ? changes : []).map((c) => ({
    field: c.field || '',
    label: c.label || humanizeKey(c.field || 'field'),
    oldValue: String(c.oldValue ?? c.from ?? '—'),
    newValue: String(c.newValue ?? c.to ?? '—'),
    from: String(c.from ?? c.oldValue ?? '—'),
    to: String(c.to ?? c.newValue ?? '—'),
  }));
}

/** Canonical org-audit details payload for partner-related mutations. */
export function partnerAuditDetails(partner, changes = [], extra = {}) {
  const fieldChanges = toAuditFieldChanges(changes);
  return {
    partnerId: partner?._id ? String(partner._id) : undefined,
    partnerCode: partner?.partnerCode || '',
    partnerName: partner?.name || '',
    changes: fieldChanges,
    fieldChanges,
    summary: formatPartnerFieldChangesSummary(partner?.name, fieldChanges),
    ...extra,
  };
}

/** Diff plain objects / subdocuments for contacts, addresses, contracts, etc. */
export function diffPlainObjectFields(prev = {}, next = {}, { fieldPrefix = '', labelPrefix = '' } = {}) {
  const changes = [];
  const prevObj = toPlain(prev) || {};
  const nextObj = toPlain(next) || {};
  const keys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);

  for (const key of keys) {
    if (
      ['_id', '__v', 'id', 'createdAt', 'updatedAt', 'organizationId', 'partnerId', 'createdBy', 'updatedBy'].includes(
        key
      )
    ) {
      continue;
    }
    const before = normalizeValue(prevObj[key]);
    const after = normalizeValue(nextObj[key]);
    if (before === after) continue;
    changes.push({
      field: fieldPrefix ? `${fieldPrefix}.${key}` : key,
      label: labelPrefix ? `${labelPrefix} · ${humanizeKey(key)}` : humanizeKey(key),
      from: displayValue(prevObj[key]),
      to: displayValue(nextObj[key]),
    });
  }
  return changes;
}

export function partnerActivityDetails(req, partner, extra = {}) {
  return {
    partnerName: partner?.name || '',
    partnerCode: partner?.partnerCode || '',
    userName: req?.user?.name || 'System',
    ...extra,
  };
}

export async function enrichPartnerStats(partner, organizationId) {
  const partnerId = partner._id;
  const [assetCount, invoiceStats, contractCount] = await Promise.all([
    Asset.countDocuments(partnerLinkQuery(partnerId, organizationId)),
    Invoice.aggregate([
      { $match: partnerLinkQuery(partnerId, organizationId) },
      {
        $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          totalPurchased: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
        },
      },
    ]),
    PartnerContract.countDocuments({ partnerId, organizationId }),
  ]);

  const stats = invoiceStats[0] || {};
  const totalPurchased = stats.totalPurchased || 0;
  const totalPaid = stats.totalPaid || 0;

  return {
    assetCount,
    invoiceCount: stats.invoiceCount || 0,
    contractCount,
    totalPurchased,
    totalPaid,
    pendingPayment: totalPurchased - totalPaid,
  };
}

const PARTNER_SETTINGS_LABELS = {
  partnerCodePrefix: 'Partner code prefix',
  defaultCurrency: 'Default currency',
  defaultPaymentTerms: 'Default payment terms',
};

const PARTNER_CONFIG_LIST_SPECS = {
  partnerTypes: {
    label: 'Partner type',
    idKey: 'id',
    nameKey: 'name',
    fields: ['name', 'description', 'color', 'isDefault'],
  },
  categories: {
    label: 'Category',
    idKey: 'id',
    nameKey: 'name',
    fields: ['name', 'description', 'color', 'isDefault'],
  },
  statuses: {
    label: 'Status',
    idKey: 'id',
    nameKey: 'name',
    fields: ['name', 'color', 'isDefault'],
  },
  addressTypes: {
    label: 'Address type',
    idKey: 'id',
    nameKey: 'name',
    fields: ['name', 'description', 'isDefault'],
  },
  profileSections: {
    label: 'Profile section',
    idKey: 'key',
    nameKey: 'label',
    fields: ['label', 'enabled'],
  },
  assetRelationshipTypes: {
    label: 'Asset relationship',
    idKey: 'key',
    nameKey: 'label',
    fields: ['label', 'resourceType'],
  },
  serviceRelationshipTypes: {
    label: 'Service relationship',
    idKey: 'key',
    nameKey: 'label',
    fields: ['label', 'resourceType'],
  },
  customFields: {
    label: 'Custom field',
    idKey: 'key',
    nameKey: 'label',
    fields: ['label', 'type', 'required', 'section', 'options'],
  },
  performanceKpis: {
    label: 'Performance KPI',
    idKey: 'key',
    nameKey: 'label',
    fields: ['label', 'enabled', 'unit', 'description', 'higherIsBetter'],
  },
  dashboardWidgetCatalog: {
    label: 'Dashboard widget',
    idKey: 'key',
    nameKey: 'label',
    fields: ['label', 'kind'],
  },
};

function listItemId(item, idKey) {
  if (!item || typeof item !== 'object') return '';
  return String(item[idKey] ?? item.id ?? item.key ?? '');
}

function listItemName(item, nameKey) {
  if (!item || typeof item !== 'object') return '(unnamed)';
  const name = item[nameKey] ?? item.name ?? item.label ?? listItemId(item, 'id');
  return String(name || '(unnamed)');
}

function diffConfigList(prevList = [], nextList = [], { field, label, idKey, nameKey, fields }) {
  const changes = [];
  const prevMap = new Map(
    (Array.isArray(prevList) ? prevList : []).map((item) => [listItemId(item, idKey), toPlain(item)])
  );
  const nextMap = new Map(
    (Array.isArray(nextList) ? nextList : []).map((item) => [listItemId(item, idKey), toPlain(item)])
  );
  const ids = new Set([...prevMap.keys(), ...nextMap.keys()]);

  for (const id of ids) {
    if (!id) continue;
    const before = prevMap.get(id);
    const after = nextMap.get(id);
    const itemLabel = listItemName(after || before, nameKey);

    if (!before && after) {
      changes.push({
        field: `${field}.${id}`,
        label: `${label} added`,
        from: '(empty)',
        to: itemLabel,
      });
      continue;
    }
    if (before && !after) {
      changes.push({
        field: `${field}.${id}`,
        label: `${label} removed`,
        from: itemLabel,
        to: '(empty)',
      });
      continue;
    }

    for (const key of fields) {
      const beforeVal = before?.[key];
      const afterVal = after?.[key];
      if (normalizeValue(beforeVal) === normalizeValue(afterVal)) continue;
      changes.push({
        field: `${field}.${id}.${key}`,
        label: `${label} “${itemLabel}” · ${humanizeKey(key)}`,
        from: displayValue(beforeVal),
        to: displayValue(afterVal),
      });
    }
  }

  return changes;
}

/** Field-level diff for partner organization settings / config. */
export function diffPartnerOrgConfig(prev = {}, next = {}, payloadKeys = null) {
  const before = toPlain(prev) || {};
  const after = toPlain(next) || {};
  const keys =
    Array.isArray(payloadKeys) && payloadKeys.length
      ? payloadKeys
      : Object.keys({ ...before, ...after });
  const changes = [];

  for (const key of keys) {
    if (['_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'updatedBy'].includes(key)) continue;

    if (key === 'settings') {
      const prevSettings = toPlain(before.settings) || {};
      const nextSettings = toPlain(after.settings) || {};
      const settingKeys = new Set([...Object.keys(prevSettings), ...Object.keys(nextSettings)]);
      for (const settingKey of settingKeys) {
        if (normalizeValue(prevSettings[settingKey]) === normalizeValue(nextSettings[settingKey])) continue;
        changes.push({
          field: `settings.${settingKey}`,
          label: PARTNER_SETTINGS_LABELS[settingKey] || humanizeKey(settingKey),
          from: displayValue(prevSettings[settingKey]),
          to: displayValue(nextSettings[settingKey]),
        });
      }
      continue;
    }

    const spec = PARTNER_CONFIG_LIST_SPECS[key];
    if (spec) {
      changes.push(
        ...diffConfigList(before[key], after[key], {
          field: key,
          ...spec,
        })
      );
      continue;
    }

    if (normalizeValue(before[key]) === normalizeValue(after[key])) continue;
    changes.push({
      field: key,
      label: humanizeKey(key),
      from: displayValue(before[key]),
      to: displayValue(after[key]),
    });
  }

  return changes;
}
