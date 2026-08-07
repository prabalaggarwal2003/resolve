'use client';

const inputClass =
  'w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const btnGhost =
  'px-2 py-1 text-[11px] font-medium rounded-lg border border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 transition-colors';
const btnDanger =
  'px-2 py-1 text-[11px] font-medium rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors';
const btnPrimary =
  'px-2.5 py-1 text-[11px] font-medium rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors';

export type PartnerRelationshipRow = {
  /** Stable UI key (persists while editing a row) */
  rowKey: string;
  /** Mongo subdocument id when the row already exists */
  _id?: string;
  partnerId: string;
  relationshipTypeKey: string;
  notes: string;
};

export type PartnerOption = { _id: string; vendorId: string; name: string };
export type RelationshipTypeOption = { key: string; label: string };

function newRowKey() {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyPartnerRelationshipRow(): PartnerRelationshipRow {
  return { rowKey: newRowKey(), partnerId: '', relationshipTypeKey: '', notes: '' };
}

export function partnerRelationshipsFromAsset(asset: Record<string, unknown>): PartnerRelationshipRow[] {
  const raw = asset.partnerRelationships;
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((row: any) => {
        const id = row?._id ? String(row._id) : '';
        return {
          rowKey: id || newRowKey(),
          _id: id || undefined,
          partnerId: String(row?.partnerId?._id || row?.partnerId || ''),
          relationshipTypeKey: String(row?.relationshipTypeKey || ''),
          notes: String(row?.notes || ''),
        };
      })
      .filter((r) => r.partnerId);
  }

  const partnerId = String(
    (asset.partnerId as any)?._id ||
      asset.partnerId ||
      (asset.vendorId as any)?._id ||
      asset.vendorId ||
      ''
  );
  if (!partnerId) return [];
  return [
    {
      rowKey: newRowKey(),
      partnerId,
      relationshipTypeKey: String(asset.relationshipTypeKey || ''),
      notes: '',
    },
  ];
}

export function serializePartnerRelationships(rows: PartnerRelationshipRow[]) {
  const seen = new Set<string>();
  return rows
    .filter((r) => r.partnerId && r.relationshipTypeKey)
    .filter((r) => {
      const key = `${r.partnerId}::${r.relationshipTypeKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => ({
      ...(r._id ? { _id: r._id } : {}),
      partnerId: r.partnerId,
      relationshipTypeKey: r.relationshipTypeKey,
      notes: r.notes.trim(),
    }));
}

export default function AssetPartnerRelationshipsEditor({
  rows,
  onChange,
  partners,
  relationshipTypes,
}: {
  rows: PartnerRelationshipRow[];
  onChange: (rows: PartnerRelationshipRow[]) => void;
  partners: PartnerOption[];
  relationshipTypes: RelationshipTypeOption[];
}) {
  const updateRow = (index: number, patch: Partial<PartnerRelationshipRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...rows, emptyPartnerRelationshipRow()]);
  };

  return (
    <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-4 py-4 mb-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/80">
            Partner relationships
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Link multiple partners and roles (e.g. purchased from, maintained by, installed by).
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={addRow}>
          Add partner
        </button>
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-gray-500">No partner relationships yet. Add one to track services for this asset.</p>
      )}

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={row.rowKey}
            className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-lg border border-gray-700/50 bg-gray-900/30 p-2.5"
          >
            <div className="md:col-span-4">
              <label className={labelClass}>Partner{index === 0 ? ' (primary)' : ''}</label>
              <select
                className={inputClass}
                value={row.partnerId}
                onChange={(e) =>
                  updateRow(index, {
                    partnerId: e.target.value,
                    ...(e.target.value ? {} : { relationshipTypeKey: '' }),
                  })
                }
              >
                <option value="">Select partner…</option>
                {partners.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.vendorId ? `${p.vendorId} — ` : ''}
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className={labelClass}>Relationship</label>
              <select
                className={inputClass}
                value={row.relationshipTypeKey}
                disabled={!row.partnerId}
                onChange={(e) => updateRow(index, { relationshipTypeKey: e.target.value })}
              >
                <option value="">{row.partnerId ? 'Select…' : 'Select partner first'}</option>
                {relationshipTypes.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <label className={labelClass}>Notes</label>
              <input
                className={inputClass}
                value={row.notes}
                placeholder="Optional"
                onChange={(e) => updateRow(index, { notes: e.target.value })}
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <button type="button" className={`${btnDanger} w-full`} onClick={() => removeRow(index)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <p className="text-[10px] text-gray-600">
          The first row is used as the primary partner for filters and list columns. Same partner can appear
          more than once with different relationship types.
        </p>
      )}
    </div>
  );
}
