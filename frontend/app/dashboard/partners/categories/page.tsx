'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { fetchPartnerConfig, updatePartnerConfig, PartnerConfig } from '@/lib/businessPartners';
import { canWrite } from '@/lib/permissions';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const btnPrimary =
  'px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors disabled:opacity-50';
const btnDanger =
  'px-2 py-0.5 text-[11px] font-medium rounded-md border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20';

export default function PartnerCategoriesPage() {
  const [config, setConfig] = useState<PartnerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newCategory, setNewCategory] = useState({ id: '', name: '' });
  const [newType, setNewType] = useState({ id: '', name: '' });
  const canEdit = canWrite('businessPartners');

  useEffect(() => {
    fetchPartnerConfig()
      .then(setConfig)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(next: Partial<PartnerConfig>) {
    if (!canEdit || !config) return;
    setSaving(true);
    try {
      const updated = await updatePartnerConfig(next);
      setConfig(updated);
    } catch (e: any) {
      alert(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  if (loading) return <LoadingSpinner message="Loading categories..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;
  if (!config) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Categories & types</h2>
        <p className="text-xs text-gray-500 mt-0.5">Manage partner categories and partner types used across the module.</p>
      </div>

      <section className="rounded-xl border border-gray-700/60 bg-gray-900/30 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-100">Categories</h3>
        <div className="rounded-lg border border-gray-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 border-b border-gray-700/60">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">ID</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Name</th>
                {canEdit && (
                  <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {config.categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-xs font-mono text-gray-400">{c.id}</td>
                  <td className="px-3 py-2 text-xs text-gray-200">
                    {canEdit ? (
                      <input
                        className={inputClass}
                        value={c.name}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            categories: config.categories.map((x) =>
                              x.id === c.id ? { ...x, name: e.target.value } : x
                            ),
                          })
                        }
                      />
                    ) : (
                      c.name
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        className={btnDanger}
                        onClick={() =>
                          setConfig({
                            ...config,
                            categories: config.categories.filter((x) => x.id !== c.id),
                          })
                        }
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2 items-end">
            <input
              className={`${inputClass} max-w-[160px]`}
              placeholder="id"
              value={newCategory.id}
              onChange={(e) => setNewCategory({ ...newCategory, id: e.target.value })}
            />
            <input
              className={`${inputClass} max-w-[200px]`}
              placeholder="Name"
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory({
                  id: newCategory.id || slugify(e.target.value),
                  name: e.target.value,
                })
              }
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (!newCategory.id || !newCategory.name) return;
                setConfig({
                  ...config,
                  categories: [...config.categories, { id: newCategory.id, name: newCategory.name }],
                });
                setNewCategory({ id: '', name: '' });
              }}
            >
              Add category
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-700/60 bg-gray-900/30 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-100">Partner types</h3>
        <div className="rounded-lg border border-gray-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 border-b border-gray-700/60">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">ID</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Name</th>
                {canEdit && (
                  <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {config.partnerTypes.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-xs font-mono text-gray-400">{t.id}</td>
                  <td className="px-3 py-2 text-xs text-gray-200">
                    {canEdit ? (
                      <input
                        className={inputClass}
                        value={t.name}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            partnerTypes: config.partnerTypes.map((x) =>
                              x.id === t.id ? { ...x, name: e.target.value } : x
                            ),
                          })
                        }
                      />
                    ) : (
                      t.name
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        className={btnDanger}
                        onClick={() =>
                          setConfig({
                            ...config,
                            partnerTypes: config.partnerTypes.filter((x) => x.id !== t.id),
                          })
                        }
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2 items-end">
            <input
              className={`${inputClass} max-w-[160px]`}
              placeholder="id"
              value={newType.id}
              onChange={(e) => setNewType({ ...newType, id: e.target.value })}
            />
            <input
              className={`${inputClass} max-w-[200px]`}
              placeholder="Name"
              value={newType.name}
              onChange={(e) =>
                setNewType({
                  id: newType.id || slugify(e.target.value),
                  name: e.target.value,
                })
              }
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (!newType.id || !newType.name) return;
                setConfig({
                  ...config,
                  partnerTypes: [...config.partnerTypes, { id: newType.id, name: newType.name }],
                });
                setNewType({ id: '', name: '' });
              }}
            >
              Add type
            </button>
          </div>
        )}
      </section>

      {canEdit && (
        <button
          type="button"
          disabled={saving}
          className={btnPrimary}
          onClick={() => save({ categories: config.categories, partnerTypes: config.partnerTypes })}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      )}
    </div>
  );
}
