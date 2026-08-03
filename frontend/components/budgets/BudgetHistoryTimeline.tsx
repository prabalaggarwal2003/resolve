'use client';

import { useMemo, useState } from 'react';
import type { BudgetHistoryEntry } from '@/lib/budgets';

const EVENT_META: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  budget_created: { icon: '＋', color: 'border-emerald-500/60 bg-emerald-500/10', label: 'Created' },
  budget_updated: { icon: '✎', color: 'border-blue-500/60 bg-blue-500/10', label: 'Updated' },
  allocation_increased: { icon: '↑', color: 'border-amber-500/60 bg-amber-500/10', label: 'Allocation ↑' },
  allocation_reduced: { icon: '↓', color: 'border-orange-500/60 bg-orange-500/10', label: 'Allocation ↓' },
  status_changed: { icon: '⇄', color: 'border-violet-500/60 bg-violet-500/10', label: 'Status' },
  purchase_linked: { icon: '⛓', color: 'border-cyan-500/60 bg-cyan-500/10', label: 'Purchase linked' },
  purchase_cancelled: { icon: '✕', color: 'border-red-500/60 bg-red-500/10', label: 'Purchase cancelled' },
  budget_closed: { icon: '🔒', color: 'border-gray-500/60 bg-gray-500/10', label: 'Closed' },
  note_added: { icon: '💬', color: 'border-slate-500/60 bg-slate-500/10', label: 'Note' },
  procurement_created: { icon: '🧾', color: 'border-emerald-500/60 bg-emerald-500/10', label: 'Purchase created' },
  procurement_updated: { icon: '✎', color: 'border-blue-500/60 bg-blue-500/10', label: 'Purchase updated' },
  procurement_deleted: { icon: '✕', color: 'border-red-500/60 bg-red-500/10', label: 'Purchase deleted' },
};

const MONEY_FIELDS = new Set([
  'allocatedAmount',
  'plannedAmount',
  'committedAmount',
  'actualSpend',
  'amount',
  'tax',
  'discount',
  'shipping',
  'totalCost',
]);

const ALL_EVENT_TYPES = Object.keys(EVENT_META);

export type OrgBudgetHistoryEntry = BudgetHistoryEntry & {
  budgetId?: { _id: string; name: string; code?: string } | string;
  budgetName?: string;
};

function formatMoney(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value ?? '—');
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function budgetLabel(entry: OrgBudgetHistoryEntry) {
  if (entry.entityType === 'procurement') {
    if (entry.entityLabel) return entry.entityLabel;
    if (typeof entry.procurementId === 'object' && entry.procurementId) {
      return entry.procurementId.purchaseId || '';
    }
    return '';
  }
  if (entry.budgetName) return entry.budgetName;
  if (entry.budgetId && typeof entry.budgetId === 'object') return entry.budgetId.name;
  if (entry.entityLabel) return entry.entityLabel;
  return '';
}

function entityKind(entry: OrgBudgetHistoryEntry) {
  if (entry.entityType === 'procurement') return 'Purchase';
  if (entry.eventType?.startsWith('procurement_') || entry.eventType === 'purchase_linked' || entry.eventType === 'purchase_cancelled') {
    return entry.eventType.startsWith('procurement_') ? 'Purchase' : 'Budget';
  }
  return 'Budget';
}

function displayChangeValue(field: string, value: unknown) {
  if (value == null || value === '') return '—';
  if (MONEY_FIELDS.has(field) && (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value)))) {
    return formatMoney(value);
  }
  // Already-formatted currency strings from backend (e.g. rollups)
  if (typeof value === 'string' && /^₹|^Rs\.?\s|\d+[.,]\d{2}$/.test(value)) return value;
  return String(value);
}

function changesFromEntry(entry: OrgBudgetHistoryEntry) {
  if (entry.changes?.length) return entry.changes;

  // Backfill field diffs for older rollup events that only stored metadata
  const meta = entry.metadata;
  if (meta?.source === 'rollup' || (meta?.prev && meta?.next)) {
    const prev = (meta.prev || {}) as Record<string, unknown>;
    const next = (meta.next || {}) as Record<string, unknown>;
    const fields = [
      { key: 'plannedAmount', label: 'Planned amount' },
      { key: 'committedAmount', label: 'Committed amount' },
      { key: 'actualSpend', label: 'Actual spend' },
    ];
    return fields
      .filter((f) => Number(prev[f.key] ?? 0) !== Number(next[f.key] ?? 0))
      .map((f) => ({
        field: f.key,
        label: f.label,
        from: formatMoney(prev[f.key] ?? 0),
        to: formatMoney(next[f.key] ?? 0),
      }));
  }

  if (meta?.from != null && meta?.to != null && (entry.eventType === 'allocation_increased' || entry.eventType === 'allocation_reduced')) {
    return [{
      field: 'allocatedAmount',
      label: 'Allocated amount',
      from: formatMoney(meta.from),
      to: formatMoney(meta.to),
    }];
  }

  if (meta?.previousStatus && meta?.newStatus) {
    return [{
      field: 'status',
      label: 'Status',
      from: String(meta.previousStatus),
      to: String(meta.newStatus),
    }];
  }

  return [];
}

function formatMetadata(entry: OrgBudgetHistoryEntry) {
  const metadata = entry.metadata;
  if (!metadata || !Object.keys(metadata).length) return null;
  const parts: string[] = [];
  if (metadata.trigger && typeof metadata.trigger === 'string') {
    parts.push(String(metadata.trigger));
  }
  if (metadata.purchaseId) parts.push(`Purchase ${metadata.purchaseId}`);
  if (metadata.amount != null && !entry.changes?.length) {
    parts.push(formatMoney(metadata.amount));
  }
  return parts.length ? parts.join(' · ') : null;
}

export default function BudgetHistoryTimeline({
  entries,
  loading,
  showBudgetName = false,
  compact = false,
}: {
  entries: OrgBudgetHistoryEntry[];
  loading?: boolean;
  showBudgetName?: boolean;
  compact?: boolean;
}) {
  const [eventFilter, setEventFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState<'all' | 'budget' | 'procurement'>('all');

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (eventFilter && e.eventType !== eventFilter) return false;
      if (entityFilter === 'all') return true;
      const kind = e.entityType || (e.eventType?.startsWith('procurement_') ? 'procurement' : 'budget');
      return kind === entityFilter;
    });
  }, [entries, eventFilter, entityFilter]);

  if (loading) {
    return <p className="text-sm text-gray-500 py-6 text-center">Loading history…</p>;
  }

  if (!entries.length) {
    return <p className="text-sm text-gray-500 py-6 text-center">No history events yet</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value as 'all' | 'budget' | 'procurement')}
        >
          <option value="all">All entities</option>
          <option value="budget">Budgets</option>
          <option value="procurement">Purchases</option>
        </select>
        <select
          className="px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
        >
          <option value="">All event types</option>
          {ALL_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_META[t]?.label || t}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-gray-600">{filtered.length} events</span>
      </div>

      <ol className={`relative ${compact ? 'space-y-2' : 'space-y-0'}`}>
        {filtered.map((entry, idx) => {
          const meta = EVENT_META[entry.eventType] || {
            icon: '•',
            color: 'border-gray-600 bg-gray-800/40',
            label: entry.eventType,
          };
          const fieldChanges = changesFromEntry(entry);
          const detail = formatMetadata(entry);
          const isLast = idx === filtered.length - 1;
          const name = budgetLabel(entry);
          const kind = entityKind(entry);

          return (
            <li key={entry._id} className="relative flex gap-3 pb-4">
              {!compact && !isLast && (
                <span className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-800" aria-hidden />
              )}
              <div
                className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-sm ${meta.color}`}
                title={meta.label}
              >
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0 pt-0.5 rounded-lg border border-gray-800/50 bg-gray-900/20 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                    kind === 'Purchase'
                      ? 'border-cyan-500/30 text-cyan-300/90 bg-cyan-500/10'
                      : 'border-violet-500/30 text-violet-300/90 bg-violet-500/10'
                  }`}>
                    {kind}
                  </span>
                  <p className="text-sm font-medium text-gray-100">{entry.label}</p>
                  <span className="text-[10px] text-gray-600 uppercase tracking-wide">{meta.label}</span>
                </div>

                {showBudgetName && name ? (
                  <p className="text-xs text-gray-300 mt-1">
                    {kind === 'Purchase' ? 'Purchase' : 'Budget'}:{' '}
                    <span className="text-violet-300/90">{name}</span>
                    {kind === 'Purchase' && entry.budgetId && typeof entry.budgetId === 'object' && entry.budgetId.name ? (
                      <span className="text-gray-500"> · Budget: {entry.budgetId.name}</span>
                    ) : null}
                  </p>
                ) : null}

                {fieldChanges.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {fieldChanges.map((c, i) => (
                      <li key={`${c.field}-${i}`} className="text-xs flex flex-wrap items-center gap-1.5">
                        <span className="text-gray-400 min-w-[7rem]">{c.label}</span>
                        <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300/90 line-through decoration-red-400/40">
                          {displayChangeValue(c.field, c.from)}
                        </span>
                        <span className="text-gray-600">→</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300/90">
                          {displayChangeValue(c.field, c.to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : entry.description ? (
                  <p className="text-xs text-gray-400 mt-1.5 whitespace-pre-wrap">{entry.description}</p>
                ) : null}

                {detail ? <p className="text-[11px] text-gray-500 mt-1.5">{detail}</p> : null}

                <p className="text-[10px] text-gray-600 mt-2">
                  {new Date(entry.createdAt).toLocaleString()}
                  {entry.userName ? ` · ${entry.userName}` : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
