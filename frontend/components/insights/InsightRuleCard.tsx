'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { InsightRule, InsightCatalog } from '@/lib/insights';
import {
  SEVERITY_STYLES,
  SEVERITY_FRIENDLY,
  describeRulePlain,
} from '@/lib/insights';

const inputClass =
  'w-full min-w-0 px-2 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const selectClass = inputClass;

export default function InsightRuleCard({
  rule,
  catalog,
  canEdit,
  onToggle,
  onSave,
  onReset,
  onDelete,
}: {
  rule: InsightRule;
  catalog: InsightCatalog;
  canEdit: boolean;
  onToggle: (enabled: boolean) => void;
  onSave: (patch: Partial<InsightRule>) => Promise<void>;
  onReset?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rule);
  const [saving, setSaving] = useState(false);
  const style = SEVERITY_STYLES[rule.severity];
  const plainRule = describeRulePlain(rule, catalog);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`w-full min-w-0 overflow-hidden rounded-xl border bg-gray-900/20 p-4 ${style.border}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
        <label className="flex items-center gap-2 shrink-0">
          <input
            type="checkbox"
            checked={rule.enabled}
            disabled={!canEdit}
            onChange={(e) => onToggle(e.target.checked)}
            className="rounded border-gray-600"
            aria-label={`Enable ${rule.name}`}
          />
          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
        </label>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold text-gray-100 break-words">{rule.name}</h3>
            <span className="text-[10px] uppercase text-gray-600 shrink-0">{rule.category}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${style.bg} ${style.text} border ${style.border}`}>
              {SEVERITY_FRIENDLY[rule.severity]}
            </span>
            {rule.isBuiltin ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700/50 text-gray-500 shrink-0">Built-in</span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-violet-500/30 text-violet-300 shrink-0">Custom</span>
            )}
          </div>
          {rule.description ? (
            <p className="text-xs text-gray-500 mt-1 break-words">{rule.description}</p>
          ) : null}
          <p className="text-xs text-gray-400 mt-1.5 break-words leading-relaxed">{plainRule}</p>
        </div>

        <div className="flex flex-wrap gap-1 shrink-0 sm:flex-col sm:items-stretch">
          <button
            type="button"
            onClick={() => setExpanded((s) => !s)}
            className="px-2 py-1 text-xs rounded border border-gray-700/60 text-gray-400 whitespace-nowrap"
          >
            {expanded ? 'Less' : 'Details'}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => { setDraft(rule); setEditing((s) => !s); }}
              className="px-2 py-1 text-xs rounded border border-gray-700/60 text-gray-300 whitespace-nowrap"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {expanded && !editing && (
        <div className="mt-3 pt-3 border-t border-gray-800/60 text-xs text-gray-400 space-y-1.5 break-words">
          <p><span className="text-gray-600">Alert message:</span> {rule.messageTemplate}</p>
          <p><span className="text-gray-600">Applies to:</span> {rule.ruleType === 'budget' ? 'Budgets' : rule.ruleType === 'aggregate' ? 'Organization' : 'Assets'}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {canEdit && !rule.isBuiltin && (
              <Link href={`/dashboard/insights/builder?edit=${rule._id}`} className="text-xs text-blue-400 no-underline hover:text-blue-300">
                Open in rule builder
              </Link>
            )}
            {canEdit && rule.isBuiltin && onReset && (
              <button type="button" onClick={onReset} className="text-xs text-amber-400">Reset to default</button>
            )}
            {canEdit && !rule.isBuiltin && onDelete && (
              <button type="button" onClick={onDelete} className="text-xs text-red-400">Delete</button>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-3 pt-3 border-t border-gray-800/60 space-y-3 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="text-[10px] text-gray-500 uppercase">Name</label>
              <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="min-w-0">
              <label className="text-[10px] text-gray-500 uppercase">Priority</label>
              <select className={selectClass} value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as InsightRule['severity'] })}>
                {catalog.severities.map((s) => (
                  <option key={s} value={s}>{SEVERITY_FRIENDLY[s as InsightRule['severity']] || s}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label className="text-[10px] text-gray-500 uppercase">Alert message</label>
              <input className={inputClass} value={draft.messageTemplate} onChange={(e) => setDraft({ ...draft, messageTemplate: e.target.value })} />
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label className="text-[10px] text-gray-500 uppercase">Description</label>
              <input className={inputClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>
          {!rule.isBuiltin && (
            <Link href={`/dashboard/insights/builder?edit=${rule._id}`} className="text-xs text-blue-400 no-underline">
              Edit conditions in rule builder →
            </Link>
          )}
          <button type="button" onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}
