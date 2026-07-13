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
  purchase_linked: { icon: '⛓', color: 'border-cyan-500/60 bg-cyan-500/10', label: 'Purchase' },
  purchase_cancelled: { icon: '✕', color: 'border-red-500/60 bg-red-500/10', label: 'Cancelled' },
  budget_closed: { icon: '🔒', color: 'border-gray-500/60 bg-gray-500/10', label: 'Closed' },
  note_added: { icon: '💬', color: 'border-slate-500/60 bg-slate-500/10', label: 'Note' },
  procurement_created: { icon: '🧾', color: 'border-emerald-500/60 bg-emerald-500/10', label: 'Purchase created' },
  procurement_updated: { icon: '✎', color: 'border-blue-500/60 bg-blue-500/10', label: 'Purchase updated' },
  procurement_deleted: { icon: '✕', color: 'border-red-500/60 bg-red-500/10', label: 'Purchase deleted' },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_META);

export type OrgBudgetHistoryEntry = BudgetHistoryEntry & {
  budgetId?: { _id: string; name: string; code?: string } | string;
  budgetName?: string;
};

function budgetLabel(entry: OrgBudgetHistoryEntry) {
  if (entry.entityType === 'procurement') {
    return entry.entityLabel || (typeof entry.procurementId === 'object' ? entry.procurementId?.purchaseId : '') || '';
  }
  if (entry.budgetName) return entry.budgetName;
  if (entry.budgetId && typeof entry.budgetId === 'object') return entry.budgetId.name;
  if (entry.entityLabel) return entry.entityLabel;
  return '';
}

function displayChangeValue(value: unknown) {
  if (value == null || value === '') return '—';
  return String(value);
}

function formatMetadata(metadata?: Record<string, unknown>) {
  if (!metadata || !Object.keys(metadata).length) return null;
  const parts: string[] = [];
  if (metadata.amount != null) {
    const amt = Number(metadata.amount);
    if (!Number.isNaN(amt)) {
      parts.push(
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt)
      );
    }
  }
  if (metadata.previousStatus && metadata.newStatus) {
    parts.push(`${metadata.previousStatus} → ${metadata.newStatus}`);
  }
  if (metadata.purchaseId) parts.push(String(metadata.purchaseId));
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

  const filtered = useMemo(() => {
    if (!eventFilter) return entries;
    return entries.filter((e) => e.eventType === eventFilter);
  }, [entries, eventFilter]);

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
          const detail = formatMetadata(entry.metadata);
          const isLast = idx === filtered.length - 1;
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
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-sm font-medium text-gray-100">{entry.label}</p>
                  <span className="text-[10px] text-gray-600 uppercase tracking-wide">{meta.label}</span>
                </div>
                {showBudgetName && budgetLabel(entry) ? (
                  <p className="text-xs text-violet-300/80 mt-0.5">{budgetLabel(entry)}</p>
                ) : null}
                {entry.description ? (
                  <p className="text-xs text-gray-500 mt-0.5">{entry.description}</p>
                ) : null}
                {entry.changes && entry.changes.length > 0 ? (
                  <ul className="mt-1.5 space-y-1">
                    {entry.changes.map((c, i) => (
                      <li key={`${c.field}-${i}`} className="text-xs flex flex-wrap items-center gap-1.5">
                        <span className="text-gray-400">{c.label}:</span>
                        <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300/90 line-through decoration-red-400/40">
                          {displayChangeValue(c.from)}
                        </span>
                        <span className="text-gray-600">→</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300/90">
                          {displayChangeValue(c.to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {detail ? <p className="text-xs text-gray-400 mt-0.5">{detail}</p> : null}
                <p className="text-[10px] text-gray-600 mt-1">
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
