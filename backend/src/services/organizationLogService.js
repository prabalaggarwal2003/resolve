import { formatChangesSummary } from './assetLogService.js';

const FIELD_LABELS = {
  name: 'Name',
  industry: 'Industry',
  companySize: 'Company size',
  country: 'Country',
  region: 'Region',
  website: 'Website',
  timezone: 'Timezone',
  currency: 'Currency',
  primaryGoal: 'Primary goal',
  estimatedAssets: 'Estimated assets',
  gstin: 'GSTIN',
  registeredAddress: 'Registered address',
  contacts: 'Contacts',
  addresses: 'Addresses',
  customFieldDefinitions: 'Custom field definitions',
  customFields: 'Custom fields',
};

function stableJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

function summarizeList(items, nameKey = 'name') {
  if (!Array.isArray(items) || !items.length) return '(empty)';
  return items
    .map((item) => item?.[nameKey] || item?.label || item?.typeKey || item?.key || 'item')
    .join(', ');
}

function formatDisplayValue(field, value) {
  if (value == null || value === '') return '—';
  if (field === 'primaryGoal') return String(value).replace(/_/g, ' ');
  if (field === 'contacts') return summarizeList(value, 'name');
  if (field === 'addresses') {
    if (!Array.isArray(value) || !value.length) return '(empty)';
    return value
      .map((a) => a?.label || a?.typeKey || [a?.city, a?.street].filter(Boolean).join(', ') || 'address')
      .join('; ');
  }
  if (field === 'customFieldDefinitions') return summarizeList(value, 'label');
  if (field === 'customFields' && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '(empty)';
    return entries.map(([k, v]) => `${k}=${v == null || v === '' ? '—' : v}`).join(', ');
  }
  if (typeof value === 'object') {
    const text = stableJson(value);
    return text.length > 180 ? `${text.slice(0, 177)}…` : text;
  }
  return String(value);
}

function valuesEqual(field, oldVal, newVal) {
  if (['contacts', 'addresses', 'customFieldDefinitions', 'customFields'].includes(field)) {
    return stableJson(oldVal) === stableJson(newVal);
  }
  const oldNorm = oldVal == null || oldVal === '' ? null : String(oldVal).trim();
  const newNorm = newVal == null || newVal === '' ? null : String(newVal).trim();
  return oldNorm === newNorm;
}

export function buildOrganizationEditChanges(prev, patchBody) {
  const changes = [];

  for (const [key, newVal] of Object.entries(patchBody)) {
    const label = FIELD_LABELS[key];
    if (!label) continue;

    const oldVal = prev[key];
    if (valuesEqual(key, oldVal, newVal)) continue;

    const oldValue = formatDisplayValue(key, oldVal);
    const newValue = formatDisplayValue(key, newVal);
    if (oldValue === newValue) continue;

    changes.push({
      field: key,
      label,
      oldValue,
      newValue,
    });
  }

  if (changes.length === 0) return null;

  return {
    fieldChanges: changes,
    summary: formatChangesSummary(changes),
  };
}
