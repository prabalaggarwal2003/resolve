'use client';

import type { BudgetHistoryChange } from '@/lib/budgets';

function displayValue(value: unknown) {
  if (value == null || value === '') return '—';
  return String(value);
}

export default function FieldChangesAlert({
  title,
  changes,
  onDismiss,
}: {
  title: string;
  changes: BudgetHistoryChange[];
  onDismiss?: () => void;
}) {
  if (!changes.length) return null;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-emerald-200">{title}</p>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="text-xs text-gray-500 hover:text-gray-300">
            Dismiss
          </button>
        ) : null}
      </div>
      <ul className="space-y-1">
        {changes.map((c, i) => (
          <li key={`${c.field}-${i}`} className="text-xs flex flex-wrap items-center gap-1.5">
            <span className="text-gray-400">{c.label}:</span>
            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300/90 line-through decoration-red-400/40">
              {displayValue(c.from)}
            </span>
            <span className="text-gray-600">→</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300/90">
              {displayValue(c.to)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
