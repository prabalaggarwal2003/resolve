'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import BudgetModuleNav from '@/components/budgets/BudgetModuleNav';
import BudgetModuleFiltersBar from '@/components/budgets/BudgetModuleFiltersBar';
import BudgetDetailFields from '@/components/budgets/BudgetDetailFields';
import { useBudgetModuleFilters } from '@/hooks/useBudgetModuleFilters';
import { budgetModuleFiltersToQuery } from '@/lib/budgetModuleFilters';
import { canWrite } from '@/lib/permissions';
import {
  UpgradePrompt,
  canAccessFeature,
  fetchOrgSubscription,
  getStoredSubscription,
} from '@/lib/subscriptionUtils';
import {
  api,
  authHeaders,
  type Budget,
  type BudgetCustomField,
  type BudgetDimension,
  type BudgetOrgConfig,
  type BudgetOption,
  type BudgetSummary,
  createBudget,
  deleteBudget,
  fetchBudgetConfig,
  fetchBudgetSummary,
  fetchBudgets,
  formatBudgetCurrency,
  updateBudget,
} from '@/lib/budgets';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

type RefData = {
  departments: { _id: string; name: string }[];
  groups: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  vendors: { _id: string; name: string }[];
  users: { _id: string; name: string }[];
  templates: { _id: string; name: string }[];
};

const EMPTY_FORM = {
  name: '',
  code: '',
  budgetTypeId: 'annual',
  financialYear: '',
  periodLabel: '',
  startDate: '',
  endDate: '',
  allocatedAmount: '',
  currency: 'INR',
  budgetOwnerId: '',
  description: '',
  status: 'draft',
  notes: '',
  dimensions: {} as Record<string, string>,
  customFields: {} as Record<string, string | number | string[]>,
};

function SummaryCard({
  label,
  value,
  accent = 'text-gray-100',
  sub,
}: {
  label: string;
  value: string | number;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-base font-semibold mt-0.5 truncate ${accent}`}>{value}</p>
      {sub ? <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p> : null}
    </div>
  );
}

function UtilizationBar({ pct, warn = 80 }: { pct: number; warn?: number }) {
  const color =
    pct >= 100 ? 'bg-red-500' : pct >= warn ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-[11px] text-gray-400 w-10 text-right">{pct}%</span>
    </div>
  );
}

function statusBadge(statusId: string, statuses: BudgetOption[]) {
  const s = statuses.find((x) => x.id === statusId);
  const color = s?.color || '#6b7280';
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border"
      style={{
        color,
        backgroundColor: `${color}22`,
        borderColor: `${color}55`,
      }}
    >
      {s?.name || statusId}
    </span>
  );
}

function flattenLocations(nodes: { _id: string; name: string; children?: unknown[] }[]): { _id: string; name: string }[] {
  const out: { _id: string; name: string }[] = [];
  const walk = (list: typeof nodes, prefix = '') => {
    for (const n of list) {
      const label = prefix ? `${prefix} / ${n.name}` : n.name;
      out.push({ _id: n._id, name: label });
      if (Array.isArray(n.children) && n.children.length) {
        walk(n.children as typeof nodes, label);
      }
    }
  };
  walk(nodes);
  return out;
}

function DimensionField({
  dim,
  value,
  onChange,
  refData,
  fundingSources,
}: {
  dim: BudgetDimension;
  value: string;
  onChange: (v: string) => void;
  refData: RefData;
  fundingSources: BudgetOption[];
}) {
  const common = { className: inputClass, value: value || '', onChange: (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => onChange(e.target.value) };

  if (dim.key === 'departmentId') {
    return (
      <select {...common}>
        <option value="">— Select —</option>
        {refData.departments.map((d) => (
          <option key={d._id} value={d._id}>{d.name}</option>
        ))}
      </select>
    );
  }
  if (dim.key === 'groupId') {
    return (
      <select {...common}>
        <option value="">— Select —</option>
        {refData.groups.map((g) => (
          <option key={g._id} value={g._id}>{g.name}</option>
        ))}
      </select>
    );
  }
  if (dim.key === 'locationId') {
    return (
      <select {...common}>
        <option value="">— Select —</option>
        {refData.locations.map((l) => (
          <option key={l._id} value={l._id}>{l.name}</option>
        ))}
      </select>
    );
  }
  if (dim.key === 'vendorId') {
    return (
      <select {...common}>
        <option value="">— Select —</option>
        {refData.vendors.map((v) => (
          <option key={v._id} value={v._id}>{v.name}</option>
        ))}
      </select>
    );
  }
  if (dim.key === 'templateId') {
    return (
      <select {...common}>
        <option value="">— Select —</option>
        {refData.templates.map((t) => (
          <option key={t._id} value={t._id}>{t.name}</option>
        ))}
      </select>
    );
  }
  if (dim.key === 'fundingSourceId') {
    return (
      <select {...common}>
        <option value="">— Select —</option>
        {fundingSources.map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
    );
  }

  return <input type="text" {...common} placeholder={dim.label} />;
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: BudgetCustomField;
  value: string | number | string[] | undefined;
  onChange: (v: string | number | string[]) => void;
}) {
  if (field.type === 'textarea') {
    return (
      <textarea
        className={`${inputClass} min-h-[72px]`}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === 'select' && field.options?.length) {
    return (
      <select
        className={inputClass}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select —</option>
        {field.options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'number' || field.type === 'currency') {
    return (
      <input
        type="number"
        className={inputClass}
        value={value === undefined || value === '' ? '' : Number(value)}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  }
  if (field.type === 'date') {
    return (
      <input
        type="date"
        className={inputClass}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      className={inputClass}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function BudgetsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const [config, setConfig] = useState<BudgetOrgConfig | null>(null);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [refData, setRefData] = useState<RefData>({
    departments: [],
    groups: [],
    locations: [],
    vendors: [],
    users: [],
    templates: [],
  });

  const { filters: moduleFilters, setFilters: setModuleFilters, clearFilters } = useBudgetModuleFilters();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);

  const canEdit = canWrite('budgets');
  const hasAccess = canAccessFeature(tier, 'budgets') && !isExpired;

  const enabledDimensions = useMemo(
    () => (config?.enabledDimensions || []).filter((d) => d.enabled),
    [config]
  );

  const detailBudget = useMemo(
    () => budgets.find((b) => b._id === detailId) || null,
    [budgets, detailId]
  );

  const financialYears = useMemo(() => {
    const years = new Set(budgets.map((b) => b.financialYear).filter((y): y is string => Boolean(y)));
    return Array.from(years).sort().reverse();
  }, [budgets]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = budgetModuleFiltersToQuery(moduleFilters);
      if (moduleFilters.search?.trim()) params.search = moduleFilters.search.trim();

      const headers = authHeaders();
      const [cfg, sum, list, deptRes, groupRes, locRes, vendorRes, userRes, tplRes] = await Promise.all([
        fetchBudgetConfig(),
        fetchBudgetSummary(),
        fetchBudgets(params),
        fetch(api('/api/departments'), { headers }).then((r) => r.json()),
        fetch(api('/api/asset-groups'), { headers }).then((r) => r.json()),
        fetch(api('/api/locations/tree'), { headers }).then((r) => r.json()),
        fetch(api('/api/vendors'), { headers }).then((r) => r.json()),
        fetch(api('/api/users'), { headers }).then((r) => r.json()),
        fetch(api('/api/asset-templates'), { headers }).then((r) => r.json()),
      ]);

      setConfig(cfg);
      setSummary(sum);
      setBudgets(list);
      setRefData({
        departments: deptRes.departments || deptRes || [],
        groups: groupRes.groups || groupRes || [],
        locations: flattenLocations(locRes.tree || locRes.locations || locRes || []),
        vendors: vendorRes.vendors || vendorRes || [],
        users: userRes.users || userRes || [],
        templates: tplRes.templates || tplRes || [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, [moduleFilters]);

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
    loadData();
  }, [subscriptionChecked, hasAccess, loadData]);

  const openCreate = () => {
    const defaultType = config?.budgetTypes?.find((t) => t.isDefault)?.id || 'annual';
    const defaultStatus = config?.budgetStatuses?.find((s) => s.isDefault)?.id || 'draft';
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      budgetTypeId: defaultType,
      status: defaultStatus,
      budgetOwnerId: user._id || user.id || '',
    });
    setShowModal(true);
  };

  const openEdit = (budget: Budget) => {
    const ownerId =
      typeof budget.budgetOwnerId === 'object' && budget.budgetOwnerId
        ? budget.budgetOwnerId._id
        : String(budget.budgetOwnerId || '');
    setEditing(budget);
    setForm({
      name: budget.name,
      code: budget.code || '',
      budgetTypeId: budget.budgetTypeId,
      financialYear: budget.financialYear || '',
      periodLabel: budget.periodLabel || '',
      startDate: budget.startDate ? budget.startDate.slice(0, 10) : '',
      endDate: budget.endDate ? budget.endDate.slice(0, 10) : '',
      allocatedAmount: String(budget.allocatedAmount),
      currency: budget.currency || 'INR',
      budgetOwnerId: ownerId,
      description: budget.description || '',
      status: budget.status,
      notes: budget.notes || '',
      dimensions: { ...(budget.dimensions || {}) },
      customFields: { ...(budget.customFields || {}) },
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Budget name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        budgetTypeId: form.budgetTypeId,
        financialYear: form.financialYear.trim(),
        periodLabel: form.periodLabel.trim(),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        allocatedAmount: Number(form.allocatedAmount) || 0,
        currency: form.currency,
        budgetOwnerId: form.budgetOwnerId || undefined,
        description: form.description,
        status: form.status,
        notes: form.notes,
        dimensions: form.dimensions,
        customFields: form.customFields,
      };
      if (editing) {
        await updateBudget(editing._id, payload);
      } else {
        await createBudget(payload);
      }
      setShowModal(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (budget: Budget) => {
    if (!confirm(`Delete budget "${budget.name}"? This cannot be undone.`)) return;
    try {
      await deleteBudget(budget._id);
      if (detailId === budget._id) setDetailId(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (!subscriptionChecked) {
    return <LoadingSpinner message="Checking subscription…" />;
  }

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-4">Budgets & Procurement</h1>
        <UpgradePrompt feature="Budgets & Procurement" />
      </div>
    );
  }

  const warnPct = config?.settings?.warnThresholdPct ?? 80;

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Budgets & Procurement</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create and manage budgets with configurable dimensions and financial tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href="/dashboard/budgets/settings"
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-700/60 text-gray-300 hover:bg-gray-800/60 no-underline"
            >
              Module settings
            </Link>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              + New budget
            </button>
          )}
        </div>
      </div>

      <BudgetModuleNav />

      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <SummaryCard label="Total budget" value={formatBudgetCurrency(summary.totalBudget)} />
          <SummaryCard label="Total spend" value={formatBudgetCurrency(summary.totalSpend)} accent="text-amber-300" />
          <SummaryCard label="Remaining" value={formatBudgetCurrency(summary.remainingBudget)} accent="text-emerald-300" />
          <SummaryCard label="Utilization" value={`${summary.utilizationPct}%`} />
          <SummaryCard label="Active" value={summary.activeBudgets} sub={`of ${summary.totalBudgets}`} />
          <SummaryCard label="Near limit" value={summary.budgetsNearLimit} accent="text-amber-300" />
          <SummaryCard label="Exceeded" value={summary.budgetsExceeded} accent="text-red-300" />
          <SummaryCard label="Pending purchases" value={summary.pendingPurchaseRequests} />
        </div>
      )}

      <BudgetModuleFiltersBar
        filters={moduleFilters}
        onChange={setModuleFilters}
        onClear={clearFilters}
        lookups={{
          budgets: budgets.map((b) => ({ _id: b._id, name: b.name })),
          budgetTypes: config?.budgetTypes || [],
          budgetStatuses: config?.budgetStatuses || [],
          fundingSources: config?.fundingSources || [],
          departments: refData.departments,
          locations: refData.locations,
          users: refData.users,
          vendors: refData.vendors,
          financialYears,
          projects: Array.from(new Set(budgets.map((b) => b.dimensions?.project).filter((p): p is string => Boolean(p)))),
          costCenters: Array.from(new Set(budgets.map((b) => b.dimensions?.costCenter).filter((c): c is string => Boolean(c)))),
        }}
      />

      {loading ? (
        <LoadingSpinner message="Loading budgets…" />
      ) : budgets.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-700/50 rounded-xl">
          <p className="text-gray-400 mb-3">No budgets yet</p>
          {canEdit && (
            <button type="button" onClick={openCreate} className="text-blue-400 hover:underline text-sm">
              Create your first budget
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
          <div className="overflow-x-auto rounded-xl border border-gray-800/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-800/80">
                  <th className="px-3 py-2 font-medium">Budget</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium text-right">Allocated</th>
                  <th className="px-3 py-2 font-medium text-right">Spend</th>
                  <th className="px-3 py-2 font-medium">Utilization</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium w-24" />
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => {
                  const typeName = config?.budgetTypes?.find((t) => t.id === b.budgetTypeId)?.name || b.budgetTypeId;
                  const selected = detailId === b._id;
                  return (
                    <tr
                      key={b._id}
                      className={`border-b border-gray-800/40 cursor-pointer transition-colors ${selected ? 'bg-blue-500/10' : 'hover:bg-gray-800/30'}`}
                      onClick={() => setDetailId(b._id)}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-100">{b.name}</p>
                        {b.code ? <p className="text-[11px] text-gray-500">{b.code}</p> : null}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400">{typeName}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">
                        {b.financialYear || b.periodLabel || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-200">
                        {formatBudgetCurrency(b.allocatedAmount, b.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-300">
                        {formatBudgetCurrency(b.actualSpend, b.currency)}
                      </td>
                      <td className="px-3 py-2.5">
                        <UtilizationBar pct={b.utilizationPct} warn={warnPct} />
                      </td>
                      <td className="px-3 py-2.5">
                        {statusBadge(b.status, config?.budgetStatuses || [])}
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <div className="flex gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => openEdit(b)}
                              className="text-[11px] text-blue-400 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(b)}
                              className="text-[11px] text-red-400 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-gray-800/80 bg-gray-900/20 p-4 min-h-[320px]">
            {!detailBudget ? (
              <p className="text-sm text-gray-500 text-center py-12">Select a budget to view its details</p>
            ) : (
              <div className="space-y-4">
                <BudgetDetailFields budget={detailBudget} config={config} refData={refData} />
                <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-800/60">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openEdit(detailBudget)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Edit budget
                    </button>
                  )}
                  <Link
                    href={`/dashboard/budgets/history?budgetId=${detailBudget._id}`}
                    className="text-xs text-gray-400 hover:text-gray-200 no-underline"
                  >
                    View history →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && config && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700/60 bg-gray-900 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-gray-800/80 bg-gray-900/95">
              <h2 className="text-base font-semibold text-gray-100">
                {editing ? 'Edit budget' : 'New budget'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Budget name *</label>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Budget code</label>
                  <input
                    className={inputClass}
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Budget type</label>
                  <select
                    className={inputClass}
                    value={form.budgetTypeId}
                    onChange={(e) => setForm((f) => ({ ...f, budgetTypeId: e.target.value }))}
                  >
                    {config.budgetTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Financial year</label>
                  <input
                    className={inputClass}
                    placeholder="e.g. FY 2025-26"
                    value={form.financialYear}
                    onChange={(e) => setForm((f) => ({ ...f, financialYear: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Budget period</label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Q1, Jan–Mar"
                    value={form.periodLabel}
                    onChange={(e) => setForm((f) => ({ ...f, periodLabel: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Start date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>End date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Allocated amount *</label>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={form.allocatedAmount}
                    onChange={(e) => setForm((f) => ({ ...f, allocatedAmount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Currency</label>
                  <select
                    className={inputClass}
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Budget owner</label>
                  <select
                    className={inputClass}
                    value={form.budgetOwnerId}
                    onChange={(e) => setForm((f) => ({ ...f, budgetOwnerId: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    {refData.users.map((u) => (
                      <option key={u._id} value={u._id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    className={inputClass}
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {config.budgetStatuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Description</label>
                  <textarea
                    className={`${inputClass} min-h-[64px]`}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Notes</label>
                  <textarea
                    className={`${inputClass} min-h-[64px]`}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>

              {enabledDimensions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Dimensions</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {enabledDimensions.map((dim) => (
                      <div key={dim.key}>
                        <label className={labelClass}>
                          {dim.label}
                          {dim.required ? ' *' : ''}
                        </label>
                        <DimensionField
                          dim={dim}
                          value={form.dimensions[dim.key] || ''}
                          onChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              dimensions: { ...f.dimensions, [dim.key]: v },
                            }))
                          }
                          refData={refData}
                          fundingSources={config.fundingSources}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(config.customFields || []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Custom fields</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {config.customFields.map((field) => (
                      <div key={field.key}>
                        <label className={labelClass}>
                          {field.label}
                          {field.required ? ' *' : ''}
                        </label>
                        <CustomFieldInput
                          field={field}
                          value={form.customFields[field.key]}
                          onChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              customFields: { ...f.customFields, [field.key]: v },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 px-4 py-3 border-t border-gray-800/80 bg-gray-900/95">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 text-sm rounded-lg border border-gray-700/60 text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
