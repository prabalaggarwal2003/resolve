'use client';

import type { ImportantChange } from '@/lib/assetChangeReason';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/40';
const buttonClass = 'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors';

export default function ChangeReasonModal({
  changes,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
  saving,
}: {
  changes: ImportantChange[];
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-lg rounded-xl border border-gray-700/60 bg-gray-900 shadow-xl"
        role="dialog"
        aria-labelledby="change-reason-title"
      >
        <div className="px-5 py-4 border-b border-gray-700/60">
          <h2 id="change-reason-title" className="text-base font-semibold text-gray-100">
            Change reason required
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            You modified important fields. Please explain why — this will be recorded in the timeline and audit log.
          </p>
        </div>

        <div className="px-5 py-4 max-h-48 overflow-y-auto">
          <ul className="space-y-2">
            {changes.map((c) => (
              <li key={c.field} className="text-xs rounded-lg border border-gray-700/50 bg-gray-800/40 px-3 py-2">
                <span className="text-gray-500 uppercase tracking-wide text-[10px]">{c.label}</span>
                <p className="text-gray-300 mt-0.5">
                  <span className="text-gray-500">{c.oldValue}</span>
                  <span className="text-gray-600 mx-1.5">→</span>
                  <span className="text-amber-200">{c.newValue}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-5 pb-5">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
            Reason *
          </label>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
            placeholder="e.g. Reassigned after employee transfer, warranty renewed after service…"
            className={inputClass}
            autoFocus
          />
        </div>

        <div className="px-5 py-4 border-t border-gray-700/60 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={`${buttonClass} border-gray-700/60 text-gray-400 hover:text-gray-200 disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || !reason.trim()}
            className={`${buttonClass} border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50`}
          >
            {saving ? 'Saving…' : 'Save with reason'}
          </button>
        </div>
      </div>
    </div>
  );
}
