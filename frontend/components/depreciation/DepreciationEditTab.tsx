'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api,
  authHeaders,
  type DepreciationPolicy,
  type PolicyAssignment,
  type YearRate,
} from '@/lib/depreciation';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';
const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';

type YearRateRow = { year: string; rate: string };

function formatYearRates(policy: DepreciationPolicy): string {
  if (policy.yearRates?.length) {
    return policy.yearRates.map((r) => `Y${r.year}: ${r.rate}%`).join(' · ');
  }
  return `${policy.rate}% flat`;
}

export default function DepreciationEditTab({
  groups,
  canEdit,
}: {
  groups: { _id: string; name: string }[];
  canEdit: boolean;
}) {
  const [policies, setPolicies] = useState<DepreciationPolicy[]>([]);
  const [assignments, setAssignments] = useState<PolicyAssignment[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    method: 'SLM' as 'SLM' | 'WDV',
    rate: '15',
    residualPct: '5',
    description: '',
    yearRates: [{ year: '1', rate: '15' }] as YearRateRow[],
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [overrideAssetId, setOverrideAssetId] = useState('');
  const [overrideRate, setOverrideRate] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(api('/api/depreciation/policies'), { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setPolicies(data.policies || []);
      setAssignments(data.assignments || []);
      setCategories(data.categories || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '',
      method: 'SLM',
      rate: '15',
      residualPct: '5',
      description: '',
      yearRates: [{ year: '1', rate: '15' }],
    });
  };

  const addYearRow = () => {
    setForm((f) => {
      const nextYear = f.yearRates.length
        ? String(Math.max(...f.yearRates.map((r) => Number(r.year) || 0)) + 1)
        : '1';
      return { ...f, yearRates: [...f.yearRates, { year: nextYear, rate: f.rate }] };
    });
  };

  const removeYearRow = (index: number) => {
    setForm((f) => ({
      ...f,
      yearRates: f.yearRates.filter((_, i) => i !== index),
    }));
  };

  const updateYearRow = (index: number, field: 'year' | 'rate', value: string) => {
    setForm((f) => ({
      ...f,
      yearRates: f.yearRates.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  };

  const savePolicy = async () => {
    if (!canEdit) return;
    setError('');
    const yearRates: YearRate[] = form.yearRates
      .map((r) => ({ year: Number(r.year), rate: Number(r.rate) }))
      .filter((r) => r.year >= 1 && !Number.isNaN(r.rate));
    const body = {
      name: form.name.trim(),
      method: form.method,
      rate: Number(form.rate),
      residualPct: Number(form.residualPct),
      description: form.description,
      yearRates,
    };
    try {
      const res = await fetch(
        api(editingId ? `/api/depreciation/policies/${editingId}` : '/api/depreciation/policies'),
        { method: editingId ? 'PATCH' : 'POST', headers: authHeaders(), body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const deletePolicy = async (id: string, name: string) => {
    if (!confirm(`Delete policy "${name}"?`)) return;
    const res = await fetch(api(`/api/depreciation/policies/${id}`), { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) { setError(data.message); return; }
    await load();
  };

  const assignmentFor = (targetType: 'group' | 'category', ref: string) =>
    assignments.find((a) => {
      if (a.targetType !== targetType) return false;
      if (targetType === 'group') return String(a.targetId) === ref;
      return a.targetKey === ref;
    });

  const assignToGroup = async (policyId: string, groupId: string) => {
    if (!groupId) return;
    if (!policyId) {
      const res = await fetch(api(`/api/depreciation/assignments/group/${groupId}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) { setError((await res.json()).message); return; }
      await load();
      return;
    }
    const res = await fetch(api('/api/depreciation/assignments'), {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ policyId, targetType: 'group', targetId: groupId }),
    });
    if (!res.ok) { setError((await res.json()).message); return; }
    await load();
  };

  const assignToCategory = async (policyId: string, category: string) => {
    if (!category) return;
    if (!policyId) {
      const res = await fetch(api(`/api/depreciation/assignments/category/${encodeURIComponent(category)}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) { setError((await res.json()).message); return; }
      await load();
      return;
    }
    const res = await fetch(api('/api/depreciation/assignments'), {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ policyId, targetType: 'category', targetKey: category }),
    });
    if (!res.ok) { setError((await res.json()).message); return; }
    await load();
  };

  const applyOverride = async (clear = false) => {
    const key = overrideAssetId.trim();
    if (!key) { setError('Asset ID required (e.g. AST-001)'); return; }
    setError('');
    const res = await fetch(api(`/api/depreciation/assets/${encodeURIComponent(key)}/override`), {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(clear ? { clear: true } : { rateOverride: Number(overrideRate), reason: overrideReason }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.message); return; }
    setOverrideRate('');
    setOverrideReason('');
    alert(clear ? 'Override cleared' : 'Override saved (logged to audit)');
  };

  const startEdit = (p: DepreciationPolicy) => {
    setEditingId(p._id);
    setForm({
      name: p.name,
      method: p.method,
      rate: String(p.rate),
      residualPct: String(p.residualPct ?? 5),
      description: p.description || '',
      yearRates: p.yearRates?.length
        ? p.yearRates.map((r) => ({ year: String(r.year), rate: String(r.rate) }))
        : [{ year: '1', rate: String(p.rate) }],
    });
  };

  if (loading) return <p className="text-sm text-gray-500">Loading policies…</p>;

  return (
    <div className="space-y-6">
      {error && <div className="p-3 rounded-lg border border-red-800 bg-red-900/20 text-red-400 text-sm">{error}</div>}

      <section className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4">
        <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest mb-3">
          {editingId ? 'Edit policy' : 'Create depreciation policy'}
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Priority: Category → Asset group → Organization default
        </p>
        {!canEdit && <p className="text-xs text-amber-400 mb-2">Read-only — you need write access to edit policies.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Name</label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={!canEdit} placeholder="Laptop Policy" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Method</label>
            <select className={inputClass} value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as 'SLM' | 'WDV' }))} disabled={!canEdit}>
              <option value="SLM">Straight Line (SLM)</option>
              <option value="WDV">Written Down Value (WDV)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Default rate % (after schedule)</label>
            <input className={inputClass} type="number" min={0} max={100} value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase">Residual %</label>
            <input className={inputClass} type="number" min={0} max={100} value={form.residualPct} onChange={(e) => setForm((f) => ({ ...f, residualPct: e.target.value }))} disabled={!canEdit} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-gray-500 uppercase">Description</label>
            <input className={inputClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} disabled={!canEdit} />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-500 uppercase">Year-wise depreciation rates</p>
            {canEdit && (
              <button type="button" onClick={addYearRow} className={`${buttonClass} border-violet-500/40 text-violet-300`}>
                + Add year
              </button>
            )}
          </div>
          <div className="space-y-2">
            {form.yearRates.map((row, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <div className="w-24">
                  <label className="text-[10px] text-gray-600">Year</label>
                  <input className={inputClass} type="number" min={1} value={row.year} disabled={!canEdit} onChange={(e) => updateYearRow(index, 'year', e.target.value)} />
                </div>
                <div className="w-28">
                  <label className="text-[10px] text-gray-600">Rate %</label>
                  <input className={inputClass} type="number" min={0} max={100} value={row.rate} disabled={!canEdit} onChange={(e) => updateYearRow(index, 'rate', e.target.value)} />
                </div>
                {canEdit && form.yearRates.length > 1 && (
                  <button type="button" onClick={() => removeYearRow(index)} className={`${buttonClass} border-red-500/30 text-red-400 mb-0.5`}>Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={savePolicy} className={`${buttonClass} border-emerald-500/40 text-emerald-300`}>
              {editingId ? 'Update policy' : 'Create policy'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Cancel</button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4">
        <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-3">Policies</p>
        <div className="space-y-2">
          {policies.map((p) => (
            <div key={p._id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
              <div>
                <p className="text-sm font-medium text-gray-100">{p.name}{p.isOrgDefault ? ' (org default)' : ''}</p>
                <p className="text-xs text-gray-500">{p.method} · {formatYearRates(p)} · residual {p.residualPct ?? 5}%</p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => startEdit(p)} className={`${buttonClass} border-gray-700/60 text-gray-300`}>Edit</button>
                  {!p.isOrgDefault && (
                    <button type="button" onClick={() => deletePolicy(p._id, p.name)} className={`${buttonClass} border-red-500/40 text-red-300`}>Delete</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4">
        <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest mb-3">Assign policies</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-gray-500 uppercase mb-2">By asset group</p>
            {groups.map((g) => {
              const cur = assignmentFor('group', g._id);
              const policyId = typeof cur?.policyId === 'object' ? cur.policyId._id : String(cur?.policyId || '');
              return (
                <div key={g._id} className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-300 w-28 truncate">{g.name}</span>
                  <select className={`${inputClass} flex-1`} value={policyId} disabled={!canEdit} onChange={(e) => assignToGroup(e.target.value, g._id)}>
                    <option value="">— No policy —</option>
                    {policies.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase mb-2">By category</p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {categories.length ? categories.map((c) => {
                const cur = assignmentFor('category', c);
                const policyId = typeof cur?.policyId === 'object' ? cur.policyId._id : String(cur?.policyId || '');
                return (
                  <div key={c} className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 w-28 truncate">{c}</span>
                    <select className={`${inputClass} flex-1`} value={policyId} disabled={!canEdit} onChange={(e) => assignToCategory(e.target.value, c)}>
                      <option value="">— No policy —</option>
                      {policies.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
                );
              }) : (
                <p className="text-xs text-gray-600">No categories found — add assets with categories first.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {canEdit && (
        <section className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4">
          <p className="text-xs font-semibold text-rose-400/80 uppercase tracking-widest mb-3">Manual rate override</p>
          <p className="text-xs text-gray-500 mb-2">Override the rate for a single asset using its system ID (e.g. AST-001). Reason is required and logged to audit.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={inputClass} placeholder="Asset ID (e.g. AST-001)" value={overrideAssetId} onChange={(e) => setOverrideAssetId(e.target.value)} />
            <input className={inputClass} type="number" placeholder="Override rate %" value={overrideRate} onChange={(e) => setOverrideRate(e.target.value)} />
            <input className={`${inputClass} sm:col-span-2`} placeholder="Reason (required)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => applyOverride(false)} className={`${buttonClass} border-rose-500/40 text-rose-300`}>Save override</button>
            <button type="button" onClick={() => applyOverride(true)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Clear override</button>
          </div>
        </section>
      )}
    </div>
  );
}
