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

export type PartnerRelationshipChangeInput = {
  rowKey?: string;
  _id?: string;
  partnerId: string;
  relationshipTypeKey: string;
  notes?: string;
};

function formatPartnerRelRow(
  row: PartnerRelationshipChangeInput,
  partners: { _id: string; vendorId?: string; name: string }[],
  relationshipTypes: { key: string; label: string }[]
): string {
  const partner = partners.find((p) => p._id === row.partnerId);
  const partnerLabel = partner
    ? `${partner.vendorId ? `${partner.vendorId} — ` : ''}${partner.name}`
    : row.partnerId;
  const rel =
    relationshipTypes.find((t) => t.key === row.relationshipTypeKey)?.label ||
    row.relationshipTypeKey.replace(/_/g, ' ');
  const note = row.notes?.trim() ? ` · ${row.notes.trim()}` : '';
  return `${partnerLabel} (${rel})${note}`;
}

function rowIdentity(row: PartnerRelationshipChangeInput) {
  if (row._id) return `id:${row._id}`;
  if (row.rowKey) return `row:${row.rowKey}`;
  return `key:${row.partnerId}::${row.relationshipTypeKey}`;
}

function normalizeChangeRow(row: PartnerRelationshipChangeInput): PartnerRelationshipChangeInput | null {
  if (!row.partnerId || !row.relationshipTypeKey) return null;
  return {
    rowKey: row.rowKey,
    _id: row._id,
    partnerId: row.partnerId,
    relationshipTypeKey: row.relationshipTypeKey,
    notes: String(row.notes || '').trim(),
  };
}

function contentEqual(a: PartnerRelationshipChangeInput, b: PartnerRelationshipChangeInput) {
  return (
    a.partnerId === b.partnerId &&
    a.relationshipTypeKey === b.relationshipTypeKey &&
    String(a.notes || '') === String(b.notes || '')
  );
}

/** Detect partner relationship list changes (add / edit / remove) — one entry per affected row. */
export function detectPartnerRelationshipChanges(
  original: PartnerRelationshipChangeInput[],
  current: PartnerRelationshipChangeInput[],
  partners: { _id: string; vendorId?: string; name: string }[],
  relationshipTypes: { key: string; label: string }[]
): ImportantChange[] {
  const before = new Map<string, PartnerRelationshipChangeInput>();
  const after = new Map<string, PartnerRelationshipChangeInput>();

  for (const row of original) {
    const normalized = normalizeChangeRow(row);
    if (!normalized) continue;
    before.set(rowIdentity(normalized), normalized);
  }
  for (const row of current) {
    const normalized = normalizeChangeRow(row);
    if (!normalized) continue;
    after.set(rowIdentity(normalized), normalized);
  }

  const changes: ImportantChange[] = [];
  const matchedAfter = new Set<string>();

  Array.from(before.entries()).forEach(([key, oldRow]) => {
    const newRow = after.get(key);
    if (newRow) {
      matchedAfter.add(key);
      if (!contentEqual(oldRow, newRow)) {
        changes.push({
          field: 'partnerRelationships',
          label: 'Partner relationship updated',
          oldValue: formatPartnerRelRow(oldRow, partners, relationshipTypes),
          newValue: formatPartnerRelRow(newRow, partners, relationshipTypes),
        });
      }
      return;
    }

    changes.push({
      field: 'partnerRelationships',
      label: 'Partner relationship removed',
      oldValue: formatPartnerRelRow(oldRow, partners, relationshipTypes),
      newValue: '—',
    });
  });

  Array.from(after.entries()).forEach(([key, newRow]) => {
    if (matchedAfter.has(key)) return;
    changes.push({
      field: 'partnerRelationships',
      label: 'Partner relationship added',
      oldValue: '—',
      newValue: formatPartnerRelRow(newRow, partners, relationshipTypes),
    });
  });

  return changes;
}
