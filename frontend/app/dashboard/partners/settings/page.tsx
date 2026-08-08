'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { fetchPartnerConfig, updatePartnerConfig, PartnerConfig } from '@/lib/businessPartners';
import { canWrite } from '@/lib/permissions';
import { apiUrl } from '@/lib/api';
import { CURRENCIES } from '@/lib/orgProfile';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const btnPrimary =
  'px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors disabled:opacity-50';
const btnDanger =
  'px-2 py-0.5 text-[11px] font-medium rounded-md border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20';
const sectionClass = 'rounded-xl border border-gray-700/60 bg-gray-900/30 p-4 space-y-3';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function PartnerSettingsPage() {
  const [config, setConfig] = useState<PartnerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canEdit = canWrite('businessPartners');

  const [newType, setNewType] = useState({ id: '', name: '' });
  const [newCategory, setNewCategory] = useState({ id: '', name: '' });
  const [newStatus, setNewStatus] = useState({ id: '', name: '', color: '#6b7280' });
  const [newAddressType, setNewAddressType] = useState({ id: '', name: '' });
  const [newAssetRel, setNewAssetRel] = useState({ key: '', label: '' });
  const [newField, setNewField] = useState({ key: '', label: '', type: 'text', required: false });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    Promise.all([
      fetchPartnerConfig(),
      fetch(apiUrl('/organization'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([partnerConfig, orgData]) => {
        const orgCurrency = String(orgData?.organization?.currency || partnerConfig.settings?.defaultCurrency || 'INR')
          .trim()
          .toUpperCase() || 'INR';
        setConfig({
          ...partnerConfig,
          settings: {
            ...partnerConfig.settings,
            defaultCurrency: orgCurrency,
          },
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!canEdit || !config) return;
    setSaving(true);
    setMessage('');
    try {
      const { defaultCurrency: _ignored, ...restSettings } = config.settings || {};
      const updated = await updatePartnerConfig({
        partnerTypes: config.partnerTypes,
        categories: config.categories,
        statuses: config.statuses,
        profileSections: config.profileSections,
        addressTypes: config.addressTypes,
        assetRelationshipTypes: config.assetRelationshipTypes,
        customFields: config.customFields,
        settings: restSettings,
      });
      setConfig({
        ...updated,
        settings: {
          ...updated.settings,
          defaultCurrency: config.settings?.defaultCurrency || updated.settings?.defaultCurrency || 'INR',
        },
      });
      setMessage('Settings saved');
    } catch (e: any) {
      alert(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading settings..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;
  if (!config) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Partner settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Configure types, sections, relationships, and defaults</p>
        </div>
        {canEdit && (
          <button type="button" className={btnPrimary} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        )}
      </div>
      {message && <p className="text-xs text-emerald-300">{message}</p>}

      <section className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-100">Defaults</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Partner code prefix</label>
            <input
              className={inputClass}
              disabled={!canEdit}
              value={config.settings?.partnerCodePrefix || ''}
              onChange={(e) =>
                setConfig({ ...config, settings: { ...config.settings, partnerCodePrefix: e.target.value } })
              }
            />
          </div>
          <div>
            <label className={labelClass}>Default currency</label>
            <p className={`${inputClass} opacity-80 cursor-default`}>
              {CURRENCIES.find((c) => c.value === config.settings?.defaultCurrency)?.label ||
                config.settings?.defaultCurrency ||
                'INR'}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">Fixed from Organization. Change it on the Organization page.</p>
          </div>
          <div>
            <label className={labelClass}>Default payment terms</label>
            <input
              className={inputClass}
              disabled={!canEdit}
              value={config.settings?.defaultPaymentTerms || ''}
              onChange={(e) =>
                setConfig({ ...config, settings: { ...config.settings, defaultPaymentTerms: e.target.value } })
              }
            />
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-100">Partner types</h3>
        <div className="space-y-2">
          {config.partnerTypes.map((t) => (
            <div key={t.id} className="flex gap-2 items-center">
              <span className="text-[11px] font-mono text-gray-500 w-36 shrink-0">{t.id}</span>
              <input
                className={inputClass}
                disabled={!canEdit}
                value={t.name}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    partnerTypes: config.partnerTypes.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)),
                  })
                }
              />
              {canEdit && (
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() =>
                    setConfig({ ...config, partnerTypes: config.partnerTypes.filter((x) => x.id !== t.id) })
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-[140px]`}
              placeholder="id"
              value={newType.id}
              onChange={(e) => setNewType({ ...newType, id: e.target.value })}
            />
            <input
              className={`${inputClass} max-w-[200px]`}
              placeholder="Name"
              value={newType.name}
              onChange={(e) => setNewType({ id: newType.id || slugify(e.target.value), name: e.target.value })}
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (!newType.id || !newType.name) return;
                setConfig({ ...config, partnerTypes: [...config.partnerTypes, { ...newType }] });
                setNewType({ id: '', name: '' });
              }}
            >
              Add type
            </button>
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-100">Categories</h3>
        <div className="space-y-2">
          {config.categories.map((c) => (
            <div key={c.id} className="flex gap-2 items-center">
              <span className="text-[11px] font-mono text-gray-500 w-36 shrink-0">{c.id}</span>
              <input
                className={inputClass}
                disabled={!canEdit}
                value={c.name}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    categories: config.categories.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)),
                  })
                }
              />
              {canEdit && (
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => setConfig({ ...config, categories: config.categories.filter((x) => x.id !== c.id) })}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-[140px]`}
              placeholder="id"
              value={newCategory.id}
              onChange={(e) => setNewCategory({ ...newCategory, id: e.target.value })}
            />
            <input
              className={`${inputClass} max-w-[200px]`}
              placeholder="Name"
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory({ id: newCategory.id || slugify(e.target.value), name: e.target.value })
              }
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (!newCategory.id || !newCategory.name) return;
                setConfig({ ...config, categories: [...config.categories, { ...newCategory }] });
                setNewCategory({ id: '', name: '' });
              }}
            >
              Add category
            </button>
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-100">Statuses</h3>
        <div className="space-y-2">
          {config.statuses.map((s) => (
            <div key={s.id} className="flex gap-2 items-center">
              <span className="text-[11px] font-mono text-gray-500 w-36 shrink-0">{s.id}</span>
              <input
                className={inputClass}
                disabled={!canEdit}
                value={s.name}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    statuses: config.statuses.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)),
                  })
                }
              />
              <input
                type="color"
                disabled={!canEdit}
                className="h-8 w-10 rounded border border-gray-700 bg-transparent"
                value={s.color || '#6b7280'}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    statuses: config.statuses.map((x) => (x.id === s.id ? { ...x, color: e.target.value } : x)),
                  })
                }
              />
              {canEdit && (
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => setConfig({ ...config, statuses: config.statuses.filter((x) => x.id !== s.id) })}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-[140px]`}
              placeholder="id"
              value={newStatus.id}
              onChange={(e) => setNewStatus({ ...newStatus, id: e.target.value })}
            />
            <input
              className={`${inputClass} max-w-[200px]`}
              placeholder="Name"
              value={newStatus.name}
              onChange={(e) => setNewStatus({ ...newStatus, id: newStatus.id || e.target.value, name: e.target.value })}
            />
            <input
              type="color"
              className="h-8 w-10 rounded border border-gray-700 bg-transparent"
              value={newStatus.color}
              onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (!newStatus.id || !newStatus.name) return;
                setConfig({ ...config, statuses: [...config.statuses, { ...newStatus }] });
                setNewStatus({ id: '', name: '', color: '#6b7280' });
              }}
            >
              Add status
            </button>
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-100">Profile sections</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {config.profileSections.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={s.enabled !== false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    profileSections: config.profileSections.map((x) =>
                      x.key === s.key ? { ...x, enabled: e.target.checked } : x
                    ),
                  })
                }
              />
              {s.label}
            </label>
          ))}
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-100">Address types</h3>
        <div className="space-y-2">
          {config.addressTypes.map((t) => (
            <div key={t.id} className="flex gap-2 items-center">
              <span className="text-[11px] font-mono text-gray-500 w-36 shrink-0">{t.id}</span>
              <input
                className={inputClass}
                disabled={!canEdit}
                value={t.name}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    addressTypes: config.addressTypes.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)),
                  })
                }
              />
              {canEdit && (
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() =>
                    setConfig({ ...config, addressTypes: config.addressTypes.filter((x) => x.id !== t.id) })
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-[140px]`}
              placeholder="id"
              value={newAddressType.id}
              onChange={(e) => setNewAddressType({ ...newAddressType, id: e.target.value })}
            />
            <input
              className={`${inputClass} max-w-[200px]`}
              placeholder="Name"
              value={newAddressType.name}
              onChange={(e) =>
                setNewAddressType({ id: newAddressType.id || slugify(e.target.value), name: e.target.value })
              }
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (!newAddressType.id || !newAddressType.name) return;
                setConfig({ ...config, addressTypes: [...config.addressTypes, { ...newAddressType }] });
                setNewAddressType({ id: '', name: '' });
              }}
            >
              Add address type
            </button>
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-100">Asset relationship types</h3>
        <div className="space-y-2">
          {config.assetRelationshipTypes.map((r) => (
            <div key={r.key} className="flex gap-2 items-center">
              <span className="text-[11px] font-mono text-gray-500 w-40 shrink-0">{r.key}</span>
              <input
                className={inputClass}
                disabled={!canEdit}
                value={r.label}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    assetRelationshipTypes: config.assetRelationshipTypes.map((x) =>
                      x.key === r.key ? { ...x, label: e.target.value } : x
                    ),
                  })
                }
              />
              {canEdit && (
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() =>
                    setConfig({
                      ...config,
                      assetRelationshipTypes: config.assetRelationshipTypes.filter((x) => x.key !== r.key),
                    })
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-[140px]`}
              placeholder="key"
              value={newAssetRel.key}
              onChange={(e) => setNewAssetRel({ ...newAssetRel, key: e.target.value })}
            />
            <input
              className={`${inputClass} max-w-[200px]`}
              placeholder="Label"
              value={newAssetRel.label}
              onChange={(e) =>
                setNewAssetRel({ key: newAssetRel.key || slugify(e.target.value), label: e.target.value })
              }
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (!newAssetRel.key || !newAssetRel.label) return;
                setConfig({
                  ...config,
                  assetRelationshipTypes: [...config.assetRelationshipTypes, { ...newAssetRel }],
                });
                setNewAssetRel({ key: '', label: '' });
              }}
            >
              Add asset relationship
            </button>
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-100">Custom fields</h3>
        <div className="space-y-2">
          {config.customFields.map((f) => (
            <div key={f.key} className="flex gap-2 items-center text-xs text-gray-300">
              <span className="font-mono text-gray-500 w-36 shrink-0">{f.key}</span>
              <span className="flex-1">{f.label}</span>
              <span className="text-gray-500">{f.type}</span>
              {canEdit && (
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() =>
                    setConfig({ ...config, customFields: config.customFields.filter((x) => x.key !== f.key) })
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {config.customFields.length === 0 && <p className="text-xs text-gray-500">No custom fields</p>}
        </div>
        {canEdit && (
          <div className="grid md:grid-cols-4 gap-2 items-end">
            <div>
              <label className={labelClass}>Key</label>
              <input
                className={inputClass}
                value={newField.key}
                onChange={(e) => setNewField({ ...newField, key: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Label</label>
              <input
                className={inputClass}
                value={newField.label}
                onChange={(e) =>
                  setNewField({
                    ...newField,
                    key: newField.key || slugify(e.target.value),
                    label: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select
                className={inputClass}
                value={newField.type}
                onChange={(e) => setNewField({ ...newField, type: e.target.value })}
              >
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="date">date</option>
                <option value="select">select</option>
              </select>
            </div>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (!newField.key || !newField.label) return;
                setConfig({
                  ...config,
                  customFields: [...config.customFields, { ...newField }],
                });
                setNewField({ key: '', label: '', type: 'text', required: false });
              }}
            >
              Add field
            </button>
          </div>
        )}
      </section>

      {canEdit && (
        <button type="button" className={btnPrimary} disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      )}
    </div>
  );
}
