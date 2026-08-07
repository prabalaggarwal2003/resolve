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
  const parts = changes.map((c) => `${c.label}: ${c.from} → ${c.to}`);
  const joined = parts.join('; ');
  if (joined.length <= 280) return `${name}: ${joined}`;
  return `${name}: ${changes.map((c) => c.label).join(', ')} updated`;
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
