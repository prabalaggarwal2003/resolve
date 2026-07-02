import type { AssetTemplate } from '@/lib/assetTemplates';

export const IMPORTANT_ASSET_FIELD_KEYS = new Set([
  'status',
  'locationId',
  'departmentId',
  'assignedToName',
  'assignedToEmployeeCode',
  'warrantyExpiry',
  'amcExpiry',
  'nextMaintenanceDate',
  'cost',
  'purchaseDate',
  'vendorId',
]);

function displayValue(key: string, val: string | string[] | undefined): string {
  if (val === undefined || val === null || val === '') return '—';
  if (Array.isArray(val)) return val.length ? val.join(', ') : '—';
  if (key === 'status') return String(val).replace(/_/g, ' ');
  return String(val);
}

function valuesEqual(
  key: string,
  a: string | string[] | undefined,
  b: string | string[] | undefined
): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : a ? [a] : [];
    const bb = Array.isArray(b) ? b : b ? [b] : [];
    if (aa.length !== bb.length) return false;
    return aa.every((v, i) => String(v) === String(bb[i]));
  }
  if (key === 'cost') {
    const an = a === '' || a === undefined ? null : Number(a);
    const bn = b === '' || b === undefined ? null : Number(b);
    return an === bn;
  }
  return String(a ?? '').trim() === String(b ?? '').trim();
}

export type ImportantChange = {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
};

export function detectImportantChanges(
  template: AssetTemplate,
  original: Record<string, string | string[]>,
  current: Record<string, string | string[]>
): ImportantChange[] {
  const changes: ImportantChange[] = [];

  for (const field of template.fields) {
    if (!IMPORTANT_ASSET_FIELD_KEYS.has(field.key)) continue;
    if (valuesEqual(field.key, original[field.key], current[field.key])) continue;
    changes.push({
      field: field.key,
      label: field.label,
      oldValue: displayValue(field.key, original[field.key]),
      newValue: displayValue(field.key, current[field.key]),
    });
  }

  return changes;
}
