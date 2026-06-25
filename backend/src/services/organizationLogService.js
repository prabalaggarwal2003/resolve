import { formatChangesSummary } from './assetLogService.js';

const FIELD_LABELS = {
  name: 'Name',
  industry: 'Industry',
  companySize: 'Company size',
  country: 'Country',
  region: 'Region',
  primaryGoal: 'Primary goal',
  estimatedAssets: 'Estimated assets',
  gstin: 'GSTIN',
  registeredAddress: 'Registered address',
};

function formatDisplayValue(field, value) {
  if (value == null || value === '') return '—';
  if (field === 'primaryGoal') return String(value).replace(/_/g, ' ');
  return String(value);
}

function valuesEqual(oldVal, newVal) {
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
    if (valuesEqual(oldVal, newVal)) continue;

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
