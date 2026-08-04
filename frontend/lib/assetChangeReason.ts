import type { AssetTemplate } from '@/lib/assetTemplates';

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

/** Detect any changed template field (reason required for all edits). */
export function detectImportantChanges(
  template: AssetTemplate,
  original: Record<string, string | string[]>,
  current: Record<string, string | string[]>
): ImportantChange[] {
  const changes: ImportantChange[] = [];

  for (const field of template.fields) {
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

const PROCUREMENT_LABELS: Record<string, string> = {
  budgetId: 'Budget',
  procurementId: 'Procurement',
  fundingSourceId: 'Funding source',
  costCenter: 'Cost center',
  purchaseOrderNumber: 'Purchase order',
  invoiceNumber: 'Invoice number',
};

/** Detect procurement/finance field changes on the edit form. */
export function detectProcurementChanges(
  original: Record<string, string>,
  current: Record<string, string>
): ImportantChange[] {
  const changes: ImportantChange[] = [];
  for (const key of Object.keys(PROCUREMENT_LABELS)) {
    if (valuesEqual(key, original[key], current[key])) continue;
    changes.push({
      field: key,
      label: PROCUREMENT_LABELS[key],
      oldValue: displayValue(key, original[key]),
      newValue: displayValue(key, current[key]),
    });
  }
  return changes;
}
