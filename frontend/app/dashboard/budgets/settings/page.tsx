'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canWrite } from '@/lib/permissions';
import {
  UpgradePrompt,
  canAccessFeature,
  fetchOrgSubscription,
  getStoredSubscription,
} from '@/lib/subscriptionUtils';
import {
  api,
  type BudgetCustomField,
  type BudgetDimension,
  type BudgetOption,
  type BudgetOrgConfig,
  type ProcurementLifecycleStage,
  fetchBudgetConfig,
  updateBudgetConfig,
} from '@/lib/budgets';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

type Tab =
  | 'types'
  | 'statuses'
  | 'funding'
  | 'dimensions'
  | 'fields'
  | 'procurement_stages'
  | 'procurement_payment'
  | 'procurement_fields'
  | 'settings';

function OptionListEditor({
  title,
  items,
  onChange,
  showColor,
  showClosed,
}: {
  title: string;
  items: BudgetOption[];
  onChange: (items: BudgetOption[]) => void;
  showColor?: boolean;
  showClosed?: boolean;
}) {
  const add = () => onChange([...items, { id: `custom_${Date.now()}`, name: '' }]);
  const update = (idx: number, patch: Partial<BudgetOption>) => {
    const next = items.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    onChange(next);
  };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

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
          <div key={item.id || idx} className="flex flex-wrap gap-2 items-center p-2 rounded-lg border border-gray-800/60 bg-gray-900/30">
            <input
              className={`${inputClass} flex-1 min-w-[140px]`}
              placeholder="Name"
              value={item.name}
              onChange={(e) => update(idx, { name: e.target.value })}
            />
            {showColor && (
              <input
                type="color"
                className="w-10 h-8 rounded cursor-pointer bg-transparent border border-gray-700/60"
                value={item.color || '#6b7280'}
                onChange={(e) => update(idx, { color: e.target.value })}
              />
            )}
            {showClosed && (
              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={Boolean(item.isClosed)}
                  onChange={(e) => update(idx, { isClosed: e.target.checked })}
                />
                Closed state
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={Boolean(item.isDefault)}
                onChange={(e) => {
                  const next = items.map((it, i) => ({
                    ...it,
                    isDefault: i === idx ? e.target.checked : false,
                  }));
                  onChange(next);
                }}
              />
              Default
            </label>
            <button type="button" onClick={() => remove(idx)} className="text-xs text-red-400 hover:underline">
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BudgetSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<Tab>('types');
  const [config, setConfig] = useState<BudgetOrgConfig | null>(null);

  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const canEdit = canWrite('budgets');
  const hasAccess = canAccessFeature(tier, 'budgets') && !isExpired;

  useEffect(() => {
    fetchOrgSubscription(api).then((sub) => {
      setTier(sub.tier);
      setIsExpired(sub.isExpired);
      setSubscriptionChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!subscriptionChecked || !hasAccess) {
      if (subscriptionChecked) setLoading(false);
      return;
    }
    fetchBudgetConfig()
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [subscriptionChecked, hasAccess]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const saved = await updateBudgetConfig(config);
      setConfig(saved);
      setSuccess('Settings saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const updateDimensions = (dims: BudgetDimension[]) => {
    setConfig((c) => (c ? { ...c, enabledDimensions: dims } : c));
  };

  const toggleDimension = (key: string, patch: Partial<BudgetDimension>) => {
    if (!config) return;
    updateDimensions(
      config.enabledDimensions.map((d) => (d.key === key ? { ...d, ...patch } : d))
    );
  };

  const addCustomField = () => {
    if (!config) return;
    const field: BudgetCustomField = {
      key: `field_${Date.now()}`,
      label: 'New field',
      type: 'text',
      section: 'Details',
    };
    setConfig({ ...config, customFields: [...config.customFields, field] });
  };

  const updateCustomField = (idx: number, patch: Partial<BudgetCustomField>) => {
    if (!config) return;
    const fields = config.customFields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    setConfig({ ...config, customFields: fields });
  };

  const removeCustomField = (idx: number) => {
    if (!config) return;
    setConfig({ ...config, customFields: config.customFields.filter((_, i) => i !== idx) });
  };

  if (!subscriptionChecked) return <LoadingSpinner message="Checking subscription…" />;

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-4">Budget module settings</h1>
        <UpgradePrompt feature="Budgets & Procurement" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-400">You do not have permission to edit budget settings.</p>
        <Link href="/dashboard/budgets" className="text-blue-400 text-sm mt-2 inline-block">
          ← Back to budgets
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'types', label: 'Budget types' },
    { id: 'statuses', label: 'Statuses' },
    { id: 'funding', label: 'Funding sources' },
    { id: 'dimensions', label: 'Dimensions' },
    { id: 'fields', label: 'Budget fields' },
    { id: 'procurement_stages', label: 'Procurement stages' },
    { id: 'procurement_payment', label: 'Payment statuses' },
    { id: 'procurement_fields', label: 'Procurement fields' },
    { id: 'settings', label: 'Automation' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/budgets" className="text-xs text-gray-500 hover:text-gray-300 no-underline">
            ← Budgets
          </Link>
          <h1 className="text-xl font-semibold text-gray-100 mt-1">Budget module settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure types, statuses, dimensions, and custom fields for your organization.
          </p>
        </div>
        <button
          type="button"
          disabled={saving || loading}
          onClick={handleSave}
          className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>
      )}
      {success && (
        <div className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
          {success}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-gray-800/80 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded-t-lg transition-colors ${
              tab === t.id
                ? 'bg-gray-800/80 text-gray-100 border border-gray-700/60 border-b-transparent -mb-px'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading || !config ? (
        <LoadingSpinner message="Loading settings…" />
      ) : (
        <div className="rounded-xl border border-gray-800/80 bg-gray-900/20 p-4">
          {tab === 'types' && (
            <OptionListEditor
              title="Budget types"
              items={config.budgetTypes}
              onChange={(budgetTypes) => setConfig({ ...config, budgetTypes })}
            />
          )}

          {tab === 'statuses' && (
            <OptionListEditor
              title="Budget statuses"
              items={config.budgetStatuses}
              onChange={(budgetStatuses) => setConfig({ ...config, budgetStatuses })}
              showColor
              showClosed
            />
          )}

          {tab === 'funding' && (
            <OptionListEditor
              title="Funding sources"
              items={config.fundingSources}
              onChange={(fundingSources) => setConfig({ ...config, fundingSources })}
            />
          )}

          {tab === 'dimensions' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400 mb-3">
                Enable dimensions to organize budgets. Multiple dimensions can be active at once.
              </p>
              {config.enabledDimensions.map((dim) => (
                <div
                  key={dim.key}
                  className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-lg border border-gray-800/60"
                >
                  <div>
                    <p className="text-sm text-gray-200">{dim.label}</p>
                    <p className="text-[10px] text-gray-600">{dim.key}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={dim.enabled}
                        onChange={(e) => toggleDimension(dim.key, { enabled: e.target.checked })}
                      />
                      Enabled
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={dim.required}
                        disabled={!dim.enabled}
                        onChange={(e) => toggleDimension(dim.key, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'fields' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-400">Add custom fields to budget forms.</p>
                <button type="button" onClick={addCustomField} className="text-xs text-blue-400 hover:underline">
                  + Add field
                </button>
              </div>
              {config.customFields.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No custom fields yet</p>
              ) : (
                config.customFields.map((field, idx) => (
                  <div key={field.key} className="p-3 rounded-lg border border-gray-800/60 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className={labelClass}>Label</label>
                        <input
                          className={inputClass}
                          value={field.label}
                          onChange={(e) => updateCustomField(idx, { label: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Type</label>
                        <select
                          className={inputClass}
                          value={field.type}
                          onChange={(e) =>
                            updateCustomField(idx, { type: e.target.value as BudgetCustomField['type'] })
                          }
                        >
                          {['text', 'number', 'date', 'select', 'textarea', 'currency'].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {field.type === 'select' && (
                      <div>
                        <label className={labelClass}>Options (comma-separated)</label>
                        <input
                          className={inputClass}
                          value={(field.options || []).join(', ')}
                          onChange={(e) =>
                            updateCustomField(idx, {
                              options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                          }
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs text-gray-400">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={(e) => updateCustomField(idx, { required: e.target.checked })}
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        onClick={() => removeCustomField(idx)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'procurement_stages' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-400">Lifecycle stages control planned vs committed vs actual rollups.</p>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      procurementLifecycleStages: [
                        ...config.procurementLifecycleStages,
                        { id: `stage_${Date.now()}`, name: 'New stage', bucket: 'planned', color: '#6b7280' },
                      ],
                    })
                  }
                  className="text-xs text-blue-400 hover:underline"
                >
                  + Add stage
                </button>
              </div>
              {(config.procurementLifecycleStages || []).map((stage, idx) => (
                <div key={stage.id || idx} className="flex flex-wrap gap-2 items-center p-2 rounded-lg border border-gray-800/60">
                  <input
                    className={`${inputClass} flex-1 min-w-[120px]`}
                    value={stage.name}
                    onChange={(e) => {
                      const stages = [...config.procurementLifecycleStages];
                      stages[idx] = { ...stage, name: e.target.value };
                      setConfig({ ...config, procurementLifecycleStages: stages });
                    }}
                  />
                  <select
                    className={`${inputClass} w-36`}
                    value={stage.bucket}
                    onChange={(e) => {
                      const stages = [...config.procurementLifecycleStages];
                      stages[idx] = { ...stage, bucket: e.target.value as ProcurementLifecycleStage['bucket'] };
                      setConfig({ ...config, procurementLifecycleStages: stages });
                    }}
                  >
                    {['planned', 'committed', 'actual', 'cancelled'].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <input
                    type="color"
                    className="w-10 h-8 rounded cursor-pointer bg-transparent border border-gray-700/60"
                    value={stage.color || '#6b7280'}
                    onChange={(e) => {
                      const stages = [...config.procurementLifecycleStages];
                      stages[idx] = { ...stage, color: e.target.value };
                      setConfig({ ...config, procurementLifecycleStages: stages });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        procurementLifecycleStages: config.procurementLifecycleStages.filter((_, i) => i !== idx),
                      })
                    }
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'procurement_payment' && (
            <OptionListEditor
              title="Payment statuses"
              items={config.procurementPaymentStatuses || []}
              onChange={(procurementPaymentStatuses) => setConfig({ ...config, procurementPaymentStatuses })}
              showColor
            />
          )}

          {tab === 'procurement_fields' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-400">Custom fields on procurement records.</p>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      procurementCustomFields: [
                        ...config.procurementCustomFields,
                        { key: `field_${Date.now()}`, label: 'New field', type: 'text', section: 'Details' },
                      ],
                    })
                  }
                  className="text-xs text-blue-400 hover:underline"
                >
                  + Add field
                </button>
              </div>
              {(config.procurementCustomFields || []).length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No procurement custom fields</p>
              ) : (
                (config.procurementCustomFields || []).map((field, idx) => (
                  <div key={field.key} className="p-3 rounded-lg border border-gray-800/60 grid grid-cols-2 gap-2">
                    <input
                      className={inputClass}
                      value={field.label}
                      onChange={(e) => {
                        const fields = [...config.procurementCustomFields];
                        fields[idx] = { ...field, label: e.target.value };
                        setConfig({ ...config, procurementCustomFields: fields });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          procurementCustomFields: config.procurementCustomFields.filter((_, i) => i !== idx),
                        })
                      }
                      className="text-xs text-red-400 hover:underline text-left"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-4 max-w-md">
              <label className="flex items-start gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={config.settings.autoUpdateOnAssetCreate}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      settings: { ...config.settings, autoUpdateOnAssetCreate: e.target.checked },
                    })
                  }
                />
                <span>
                  <span className="font-medium">Auto-update on asset create</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Deduct actual spend when assets are linked to a budget.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={config.settings.autoUpdateOnPurchaseApprove}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      settings: { ...config.settings, autoUpdateOnPurchaseApprove: e.target.checked },
                    })
                  }
                />
                <span>
                  <span className="font-medium">Auto-update on purchase approve</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Update committed/planned amounts when procurement is approved.
                  </span>
                </span>
              </label>
              <div>
                <label className={labelClass}>Warning threshold (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={config.settings.warnThresholdPct}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      settings: { ...config.settings, warnThresholdPct: Number(e.target.value) || 80 },
                    })
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Critical threshold (%)</label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  className={inputClass}
                  value={config.settings.criticalThresholdPct}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      settings: { ...config.settings, criticalThresholdPct: Number(e.target.value) || 100 },
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
