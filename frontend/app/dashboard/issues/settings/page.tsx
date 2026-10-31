'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canTicketAction } from '@/lib/permissions';
import {
  fetchIssueConfig,
  updateIssueConfig,
  type IssueOption,
  type IssueOrgConfig,
  type IssueTypeOption,
} from '@/lib/issues';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

type Tab = 'statuses' | 'types' | 'priorities' | 'severities' | 'settings' | 'workflow';

function OptionListEditor({
  title,
  items,
  onChange,
  showClosed,
  editable = true,
}: {
  title: string;
  items: IssueOption[];
  onChange: (items: IssueOption[]) => void;
  showClosed?: boolean;
  editable?: boolean;
}) {
  const add = () =>
    onChange([...items, { id: `custom_${Date.now()}`, name: '', color: '#6b7280' }]);
  const update = (idx: number, patch: Partial<IssueOption>) => {
    onChange(
      items.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, ...patch };
        if (
          patch.name !== undefined &&
          (!next.id || /^custom_\d+$/i.test(next.id)) &&
          patch.name.trim()
        ) {
          const slug = patch.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 48);
          if (slug) next.id = slug;
        }
        return next;
      })
    );
  };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  if (!editable) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-200">{title}</p>
        {items.length === 0 ? (
          <p className="text-xs text-gray-600">None configured.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-800/60 bg-gray-900/30"
              >
                <span
                  className="inline-block w-3 h-3 rounded-full border border-gray-700/60 shrink-0"
                  style={{ backgroundColor: item.color || '#6b7280' }}
                />
                <span className="text-sm text-gray-200">{item.name || '—'}</span>
                {item.isDefault && (
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">Default</span>
                )}
                {showClosed && item.isClosed && (
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">Closed</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-200">{title}</p>
        <button type="button" onClick={add} className="text-xs text-blue-400 hover:underline">
          + Add
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.id || idx}
            className="flex flex-wrap gap-2 items-center p-2 rounded-lg border border-gray-800/60 bg-gray-900/30"
          >
            <input
              className={`${inputClass} flex-1 min-w-[140px]`}
              placeholder="Name"
              value={item.name}
              onChange={(e) => update(idx, { name: e.target.value })}
            />
            <input
              type="color"
              className="w-10 h-8 rounded cursor-pointer bg-transparent border border-gray-700/60"
              value={item.color || '#6b7280'}
              onChange={(e) => update(idx, { color: e.target.value })}
            />
            {showClosed && (
              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={Boolean(item.isClosed)}
                  onChange={(e) => update(idx, { isClosed: e.target.checked })}
                />
                Closed
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={Boolean(item.isDefault)}
                onChange={(e) => {
                  onChange(
                    items.map((it, i) => ({
                      ...it,
                      isDefault: i === idx ? e.target.checked : false,
                    }))
                  );
                }}
              />
              Default
            </label>
            <button type="button" onClick={() => remove(idx)} className="text-xs text-red-400">
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IssuesSettingsPage() {
  const [tab, setTab] = useState<Tab>('statuses');
  const [config, setConfig] = useState<IssueOrgConfig | null>(null);
  const [workflows, setWorkflows] = useState<{ key: string; name: string; description?: string; transitions?: { from: string; to: string; requireReason?: boolean }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const writable = canTicketAction('manage_config');

  useEffect(() => {
    fetchIssueConfig()
      .then((data) => {
        setConfig(data.config);
        setWorkflows(data.workflows || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!config || !writable) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await updateIssueConfig(config);
      setConfig(data.config);
      setMessage('Saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading configuration..." />;
  if (!config) return <p className="text-sm text-red-400">{error || 'Config unavailable'}</p>;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'statuses', label: 'Statuses' },
    { id: 'types', label: 'Issue types' },
    { id: 'priorities', label: 'Priorities' },
    { id: 'severities', label: 'Severities' },
    { id: 'workflow', label: 'Workflow' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link href="/dashboard/issues" className="text-xs text-blue-400 no-underline">
              ← Tickets
            </Link>
            <h1 className="text-2xl font-bold text-gray-100 mt-1">Issues configuration</h1>
            <p className="text-sm text-gray-500 mt-1">
              Organization-specific statuses, types, forms, and ticket settings.
              {!writable && ' View only — you do not have permission to edit configuration.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/issues/employees"
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 no-underline"
            >
              Employees
            </Link>
            <Link
              href="/dashboard/issues/automation"
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 no-underline"
            >
              Automation & Escalations
            </Link>
            <Link
              href="/dashboard/issues/contacts"
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 no-underline"
            >
              Contacts
            </Link>
            {writable && (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>
        </div>

      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-lg border ${
              tab === t.id
                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                : 'border-gray-700/60 text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-4">
        {tab === 'statuses' && (
          <div className="space-y-3">
            <p className="text-[11px] text-gray-500">
              Saved statuses appear as filters on the tickets list. New custom statuses also get
              workflow transitions so you can move tickets into them.
            </p>
            <OptionListEditor
              title="Statuses"
              items={config.statuses}
              showClosed
              editable={writable}
              onChange={(statuses) => setConfig({ ...config, statuses })}
            />
          </div>
        )}
        {tab === 'types' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-200">Issue types & forms</p>
              {writable && (
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      issueTypes: [
                        ...config.issueTypes,
                        {
                          id: `type_${Date.now()}`,
                          name: '',
                          formFields: [
                            {
                              key: 'description',
                              label: 'Description',
                              type: 'textarea',
                              required: true,
                            },
                          ],
                        },
                      ],
                    })
                  }
                  className="text-xs text-blue-400 hover:underline"
                >
                  + Add type
                </button>
              )}
            </div>
            {config.issueTypes.map((type, typeIdx) => (
              <div key={type.id} className="rounded-lg border border-gray-800/60 p-3 space-y-2">
                {writable ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      className={`${inputClass} flex-1 min-w-[140px]`}
                      placeholder="Type name"
                      value={type.name}
                      onChange={(e) => {
                        const issueTypes = config.issueTypes.map((t, i) =>
                          i === typeIdx ? { ...t, name: e.target.value } : t
                        );
                        setConfig({ ...config, issueTypes });
                      }}
                    />
                    <input
                      type="color"
                      className="w-10 h-8 rounded cursor-pointer bg-transparent border border-gray-700/60"
                      value={type.color || '#6b7280'}
                      onChange={(e) => {
                        const issueTypes = config.issueTypes.map((t, i) =>
                          i === typeIdx ? { ...t, color: e.target.value } : t
                        );
                        setConfig({ ...config, issueTypes });
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full border border-gray-700/60"
                      style={{ backgroundColor: type.color || '#6b7280' }}
                    />
                    <p className="text-sm font-medium text-gray-200">{type.name || '—'}</p>
                  </div>
                )}
                <p className="text-[11px] text-gray-500">
                  Form fields ({type.formFields?.length || 0})
                </p>
                <div className="space-y-1.5">
                  {(type.formFields || []).map((field, fieldIdx) =>
                    writable ? (
                      <div
                        key={field.key || fieldIdx}
                        className="rounded-lg border border-gray-800/50 bg-gray-950/30 p-2 space-y-2"
                      >
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <input
                            className={`${inputClass} flex-1 min-w-[100px] text-xs`}
                            value={field.label}
                            placeholder="Label"
                            onChange={(e) => {
                              const issueTypes = config.issueTypes.map((t, i) => {
                                if (i !== typeIdx) return t;
                                const formFields = (t.formFields || []).map((f, fi) =>
                                  fi === fieldIdx ? { ...f, label: e.target.value } : f
                                );
                                return { ...t, formFields };
                              });
                              setConfig({ ...config, issueTypes });
                            }}
                          />
                          <select
                            className={`${inputClass} w-28 text-xs`}
                            value={field.type}
                            onChange={(e) => {
                              const nextType = e.target.value;
                              const needsOptions = ['dropdown', 'multiselect', 'checkbox'].includes(
                                nextType
                              );
                              const issueTypes = config.issueTypes.map((t, i) => {
                                if (i !== typeIdx) return t;
                                const formFields = (t.formFields || []).map((f, fi) => {
                                  if (fi !== fieldIdx) return f;
                                  const next = { ...f, type: nextType };
                                  if (needsOptions && !Array.isArray(next.options)) {
                                    next.options = [];
                                  }
                                  return next;
                                });
                                return { ...t, formFields };
                              });
                              setConfig({ ...config, issueTypes });
                            }}
                          >
                            {[
                              'text',
                              'textarea',
                              'number',
                              'dropdown',
                              'multiselect',
                              'date',
                              'checkbox',
                              'attachment',
                            ].map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1 text-[10px] text-gray-400">
                            <input
                              type="checkbox"
                              checked={Boolean(field.required)}
                              onChange={(e) => {
                                const issueTypes = config.issueTypes.map((t, i) => {
                                  if (i !== typeIdx) return t;
                                  const formFields = (t.formFields || []).map((f, fi) =>
                                    fi === fieldIdx ? { ...f, required: e.target.checked } : f
                                  );
                                  return { ...t, formFields };
                                });
                                setConfig({ ...config, issueTypes });
                              }}
                            />
                            Req
                          </label>
                          <button
                            type="button"
                            className="text-[10px] text-red-400"
                            onClick={() => {
                              const issueTypes = config.issueTypes.map((t, i) => {
                                if (i !== typeIdx) return t;
                                return {
                                  ...t,
                                  formFields: (t.formFields || []).filter((_, fi) => fi !== fieldIdx),
                                };
                              });
                              setConfig({ ...config, issueTypes });
                            }}
                          >
                            ✕
                          </button>
                        </div>

                        {['dropdown', 'multiselect'].includes(field.type) && (
                          <div className="pl-1 space-y-1.5">
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                              Options
                              <span className="normal-case text-gray-600 font-normal">
                                {' '}
                                — one choice per line (shown on report & ticket forms)
                              </span>
                            </p>
                            <textarea
                              className={`${inputClass} text-xs font-mono min-h-[72px]`}
                              rows={3}
                              placeholder={'Option A\nOption B\nOption C'}
                              value={(field.options || []).join('\n')}
                              onChange={(e) => {
                                const options = e.target.value
                                  .split('\n')
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                const issueTypes = config.issueTypes.map((t, i) => {
                                  if (i !== typeIdx) return t;
                                  const formFields = (t.formFields || []).map((f, fi) =>
                                    fi === fieldIdx ? { ...f, options } : f
                                  );
                                  return { ...t, formFields };
                                });
                                setConfig({ ...config, issueTypes });
                              }}
                            />
                            {(field.options || []).length === 0 && (
                              <p className="text-[10px] text-amber-400/90">
                                Add at least one option or the dropdown will be empty.
                              </p>
                            )}
                            {(field.options || []).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {(field.options || []).map((opt) => (
                                  <span
                                    key={opt}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-gray-700/60 bg-gray-800/50 text-gray-300"
                                  >
                                    {opt}
                                    <button
                                      type="button"
                                      className="text-gray-500 hover:text-red-400"
                                      aria-label={`Remove ${opt}`}
                                      onClick={() => {
                                        const options = (field.options || []).filter((o) => o !== opt);
                                        const issueTypes = config.issueTypes.map((t, i) => {
                                          if (i !== typeIdx) return t;
                                          const formFields = (t.formFields || []).map((f, fi) =>
                                            fi === fieldIdx ? { ...f, options } : f
                                          );
                                          return { ...t, formFields };
                                        });
                                        setConfig({ ...config, issueTypes });
                                      }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {field.type === 'checkbox' && (
                          <div className="pl-1 space-y-1.5">
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                              Checkbox options
                              <span className="normal-case text-gray-600 font-normal">
                                {' '}
                                — leave empty for a single Yes/No checkbox; add lines for a multi-select
                                checklist
                              </span>
                            </p>
                            <textarea
                              className={`${inputClass} text-xs font-mono min-h-[56px]`}
                              rows={2}
                              placeholder={'Leave empty for Yes/No\nor list choices…'}
                              value={(field.options || []).join('\n')}
                              onChange={(e) => {
                                const options = e.target.value
                                  .split('\n')
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                const issueTypes = config.issueTypes.map((t, i) => {
                                  if (i !== typeIdx) return t;
                                  const formFields = (t.formFields || []).map((f, fi) =>
                                    fi === fieldIdx ? { ...f, options } : f
                                  );
                                  return { ...t, formFields };
                                });
                                setConfig({ ...config, issueTypes });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        key={field.key || fieldIdx}
                        className="flex flex-wrap gap-2 items-center text-xs text-gray-300 px-2 py-1 rounded border border-gray-800/50"
                      >
                        <span>{field.label || '—'}</span>
                        <span className="text-gray-500">{field.type}</span>
                        {field.required && <span className="text-gray-500">Required</span>}
                        {(field.options || []).length > 0 && (
                          <span className="text-gray-500 truncate max-w-full">
                            Options: {(field.options || []).join(', ')}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
                {writable && (
                  <button
                    type="button"
                    className="text-[11px] text-blue-400 hover:underline"
                    onClick={() => {
                      const issueTypes = config.issueTypes.map((t, i) => {
                        if (i !== typeIdx) return t;
                        return {
                          ...t,
                          formFields: [
                            ...(t.formFields || []),
                            {
                              key: `field_${Date.now()}`,
                              label: 'New field',
                              type: 'text',
                              required: false,
                            },
                          ],
                        };
                      });
                      setConfig({ ...config, issueTypes });
                    }}
                  >
                    + Add field
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {tab === 'priorities' && (
          <OptionListEditor
            title="Priorities"
            items={config.priorities}
            editable={writable}
            onChange={(priorities) => setConfig({ ...config, priorities })}
          />
        )}
        {tab === 'severities' && (
          <OptionListEditor
            title="Severities"
            items={config.severities}
            editable={writable}
            onChange={(severities) => setConfig({ ...config, severities })}
          />
        )}
        {tab === 'workflow' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              Default workflow transitions (read-only). Full workflow editor comes later.
            </p>
            {workflows.map((wf) => (
              <div key={wf.key} className="rounded-lg border border-gray-800/60 p-3">
                <p className="text-sm font-medium text-gray-200">{wf.name}</p>
                {wf.description && <p className="text-xs text-gray-500 mt-1">{wf.description}</p>}
                <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                  {(wf.transitions || []).map((t, i) => (
                    <p key={i} className="text-[11px] text-gray-400 font-mono">
                      {t.from} → {t.to}
                      {t.requireReason ? ' (reason)' : ''}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'settings' && (
          <div className="space-y-3 max-w-md">
            {!writable && (
              <p className="text-[11px] text-gray-500 mb-1">
                Configuration is view-only for your role.
              </p>
            )}
            <div>
              <label className={labelClass}>Ticket ID prefix</label>
              {writable ? (
                <input
                  className={inputClass}
                  value={config.settings.ticketPrefix}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      settings: {
                        ...config.settings,
                        ticketPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
                      },
                    })
                  }
                />
              ) : (
                <p className="text-sm text-gray-200">{config.settings.ticketPrefix || '—'}</p>
              )}
              <p className="text-[11px] text-gray-600 mt-1">
                New tickets use {'{PREFIX}-{YYYY}-{NNN}'} (e.g. TKT-2026-001). Existing ISS-* IDs are kept.
              </p>
            </div>
            <div>
              <label className={labelClass}>Default priority</label>
              {writable ? (
                <select
                  className={inputClass}
                  value={config.settings.defaultPriorityId}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      settings: { ...config.settings, defaultPriorityId: e.target.value },
                    })
                  }
                >
                  {config.priorities.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-200">
                  {config.priorities.find((p) => p.id === config.settings.defaultPriorityId)?.name ||
                    config.settings.defaultPriorityId ||
                    '—'}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Default issue type</label>
              {writable ? (
                <select
                  className={inputClass}
                  value={config.settings.defaultIssueTypeId}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      settings: { ...config.settings, defaultIssueTypeId: e.target.value },
                    })
                  }
                >
                  {config.issueTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-200">
                  {config.issueTypes.find((t) => t.id === config.settings.defaultIssueTypeId)?.name ||
                    config.settings.defaultIssueTypeId ||
                    '—'}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-gray-800/60 space-y-3">
              <p className="text-xs font-medium text-gray-300">Verification & closure</p>
              {writable ? (
                <>
                  <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-gray-600 bg-gray-800 text-blue-500"
                      checked={config.settings.requireVerificationBeforeClose !== false}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          settings: {
                            ...config.settings,
                            requireVerificationBeforeClose: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>
                      Require verification before closure
                      <span className="block text-[11px] text-gray-500 font-normal">
                        ON: Resolved → Verified → Closed. OFF: Resolved → Closed directly.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-gray-600 bg-gray-800 text-blue-500"
                      disabled={config.settings.requireVerificationBeforeClose === false}
                      checked={config.settings.preventSelfVerification !== false}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          settings: {
                            ...config.settings,
                            preventSelfVerification: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>
                      Prevent self-verification
                      <span className="block text-[11px] text-gray-500 font-normal">
                        The user who resolved a ticket cannot also verify it.
                      </span>
                    </span>
                  </label>
                </>
              ) : (
                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    Require verification before closure:{' '}
                    <span className="text-gray-200">
                      {config.settings.requireVerificationBeforeClose !== false ? 'ON' : 'OFF'}
                    </span>
                  </p>
                  <p>
                    Prevent self-verification:{' '}
                    <span className="text-gray-200">
                      {config.settings.preventSelfVerification !== false ? 'ON' : 'OFF'}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
