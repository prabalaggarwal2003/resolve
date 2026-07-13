'use client';

import { useEffect, useState } from 'react';
import {
  createHealthProfile,
  deleteHealthProfile,
  fetchHealthConfig,
  fetchHealthProfiles,
  updateHealthProfile,
  factorLabel,
  getAllFactorKeys,
  type HealthFactorConfig,
  type HealthProfile,
} from '@/lib/assetHealth';

const inputClass = 'w-full px-2 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-900/60 text-gray-200';
const buttonClass = 'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors';

export default function AssetHealthProfilesPanel({
  groups,
}: {
  groups: { _id: string; name: string }[];
}) {
  const [profiles, setProfiles] = useState<HealthProfile[]>([]);
  const [baseFactors, setBaseFactors] = useState<HealthFactorConfig>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFactors, setEditFactors] = useState<Record<string, { enabled: boolean; weight: number }>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [profilesList, config] = await Promise.all([fetchHealthProfiles(), fetchHealthConfig()]);
      setProfiles(profilesList);
      setBaseFactors(config.factors);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const factorKeys = getAllFactorKeys(baseFactors);

  const buildFactorsFromBase = () => {
    const factors: Record<string, { enabled: boolean; weight: number }> = {};
    for (const key of factorKeys) {
      factors[key] = {
        enabled: baseFactors[key]?.enabled !== false,
        weight: baseFactors[key]?.weight ?? 0,
      };
    }
    return factors;
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createHealthProfile({
        name: name.trim(),
        groupId: groupId || null,
        enabled: true,
        factors: buildFactorsFromBase(),
      });
      setName('');
      setGroupId('');
      setMessage('Profile created');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const startEdit = (profile: HealthProfile) => {
    setEditingId(profile._id);
    const factors = buildFactorsFromBase();
    for (const [k, v] of Object.entries(profile.factors || {})) {
      if (factors[k]) factors[k] = { ...factors[k], ...v };
    }
    setEditFactors(factors);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const total = Object.entries(editFactors).filter(([, f]) => f.enabled).reduce((s, [, f]) => s + f.weight, 0);
    if (total !== 100) {
      setMessage(`Weights must total 100% (currently ${total}%)`);
      return;
    }
    await updateHealthProfile(editingId, { factors: editFactors });
    setEditingId(null);
    setMessage('Profile saved');
    await load();
  };

  const toggleEnabled = async (profile: HealthProfile) => {
    await updateHealthProfile(profile._id, { enabled: !profile.enabled });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this health profile?')) return;
    await deleteHealthProfile(id);
    await load();
  };

  if (loading) return <p className="text-sm text-gray-500">Loading profiles…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-700/50 bg-gray-900/30 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">New profile</h3>
        <input className={inputClass} placeholder="Profile name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inputClass} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Select asset group</option>
          {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
        </select>
        <button type="button" onClick={handleCreate} className={`${buttonClass} border-gray-600 text-gray-200 hover:bg-gray-800`}>
          Create profile
        </button>
      </div>

      {message && <p className="text-xs text-gray-400">{message}</p>}

      <div className="space-y-2">
        {profiles.map((p) => (
          <div key={p._id} className="rounded-lg border border-gray-700/60 bg-gray-800/30 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-100">{p.name}</p>
                <p className="text-xs text-gray-500">
                  {p.groupId ? groups.find((g) => g._id === p.groupId)?.name || 'Group linked' : 'No group'}
                  {p.enabled ? '' : ' · Disabled'}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => startEdit(p)} className={`${buttonClass} border-gray-700 text-gray-300`}>Edit weights</button>
                <button type="button" onClick={() => toggleEnabled(p)} className={`${buttonClass} border-gray-700 text-gray-300`}>
                  {p.enabled ? 'Disable' : 'Enable'}
                </button>
                <button type="button" onClick={() => handleDelete(p._id)} className={`${buttonClass} border-red-900/50 text-red-400`}>Delete</button>
              </div>
            </div>
            {editingId === p._id && (
              <div className="border-t border-gray-700/40 pt-2 space-y-2">
                {factorKeys.map((key) => {
                  const label = factorLabel(key, baseFactors);
                  const f = editFactors[key] || { enabled: true, weight: 0 };
                  return (
                    <div key={key} className="flex items-center gap-3 text-sm">
                      <label className="flex items-center gap-2 text-gray-300 min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={f.enabled !== false}
                          onChange={() => setEditFactors((prev) => ({
                            ...prev,
                            [key]: { ...f, enabled: !f.enabled },
                          }))}
                        />
                        {label}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={f.enabled === false}
                        value={f.weight}
                        onChange={(e) => setEditFactors((prev) => ({
                          ...prev,
                          [key]: { ...f, weight: Number(e.target.value) },
                        }))}
                        className="w-16 px-2 py-0.5 text-xs border border-gray-700 rounded bg-gray-900 text-gray-200"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  );
                })}
                <button type="button" onClick={saveEdit} className={`${buttonClass} bg-gray-700 border-gray-600 text-white`}>Save weights</button>
              </div>
            )}
          </div>
        ))}
        {!profiles.length && <p className="text-sm text-gray-500">No group profiles yet.</p>}
      </div>
    </div>
  );
}
