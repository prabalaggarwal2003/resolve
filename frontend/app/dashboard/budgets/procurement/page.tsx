'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BudgetModuleFiltersBar from '@/components/budgets/BudgetModuleFiltersBar';
import { useBudgetModuleFilters } from '@/hooks/useBudgetModuleFilters';
import { budgetModuleFiltersToQuery } from '@/lib/budgetModuleFilters';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import BudgetModuleNav from '@/components/budgets/BudgetModuleNav';
import { canWrite } from '@/lib/permissions';
import {
  UpgradePrompt,
  canAccessFeature,
  fetchOrgSubscription,
  getStoredSubscription,
} from '@/lib/subscriptionUtils';
import FieldChangesAlert from '@/components/budgets/FieldChangesAlert';
import {
  fetchBudgetConfig,
  fetchBudgets,
  type Budget,
  type BudgetHistoryChange,
  type BudgetOrgConfig,
  formatBudgetCurrency,
} from '@/lib/budgets';
import {
  api,
  authHeaders,
  computeProcurementTotal,
  createProcurement,
  deleteProcurement,
  fetchProcurementSummary,
  fetchProcurements,
  type Procurement,
  type ProcurementSummary,
  updateProcurement,
} from '@/lib/procurement';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

const EMPTY_FORM = {
  purchaseOrderNumber: '',
  invoiceNumber: '',
  vendorId: '',
  purchaseDate: '',
  budgetId: '',
  departmentId: '',
  amount: '',
  tax: '',
  discount: '',
  shipping: '',
  lifecycleStage: 'planned',
  paymentStatus: 'unpaid',
  fundingSourceId: '',
  costCenter: '',
  project: '',
  notes: '',
};

function refId(val: unknown) {
  if (!val) return '';
  if (typeof val === 'object' && val !== null && '_id' in val) return String((val as { _id: string })._id);
  return String(val);
}

function stageBadge(stageId: string, stages: BudgetOrgConfig['procurementLifecycleStages']) {
  const s = stages?.find((x) => x.id === stageId);
  const color = s?.color || '#6b7280';
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border"
      style={{ color, backgroundColor: `${color}22`, borderColor: `${color}55` }}
    >
      {s?.name || stageId}
    </span>
  );
}

export default function ProcurementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastChanges, setLastChanges] = useState<BudgetHistoryChange[] | null>(null);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const [config, setConfig] = useState<BudgetOrgConfig | null>(null);
  const [summary, setSummary] = useState<ProcurementSummary | null>(null);
  const [records, setRecords] = useState<Procurement[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ _id: string; name: string; vendorId?: string }[]>([]);

  const { filters: moduleFilters, setFilters: setModuleFilters, clearFilters } = useBudgetModuleFilters();
  const [procFilters, setProcFilters] = useState({ lifecycleStage: '', paymentStatus: '' });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Procurement | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const canEdit = canWrite('budgets');
  const hasAccess = canAccessFeature(tier, 'budgets') && !isExpired;

  const computedTotal = useMemo(
    () =>
      computeProcurementTotal(
        Number(form.amount) || 0,
        Number(form.tax) || 0,
        Number(form.discount) || 0,
        Number(form.shipping) || 0
      ),
    [form.amount, form.tax, form.discount, form.shipping]
  );

  const detail = useMemo(() => records.find((r) => r._id === detailId) || null, [records, detailId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...budgetModuleFiltersToQuery(moduleFilters) };
      if (moduleFilters.search?.trim()) params.search = moduleFilters.search.trim();
      if (procFilters.lifecycleStage) params.lifecycleStage = procFilters.lifecycleStage;
      if (procFilters.paymentStatus) params.paymentStatus = procFilters.paymentStatus;

      const headers = authHeaders();
      const [cfg, sum, list, budgetList, deptRes, vendorRes] = await Promise.all([
        fetchBudgetConfig(),
        fetchProcurementSummary(),
        fetchProcurements(params),
        fetchBudgets({ status: 'active' }),
        fetch(api('/api/departments'), { headers }).then((r) => r.json()),
        fetch(api('/api/vendors?status=Active'), { headers }).then((r) => r.json()),
      ]);
      setConfig(cfg);
      setSummary(sum);
      setRecords(list);
      setBudgets(budgetList);
      setDepartments(deptRes.departments || deptRes || []);
      setVendors(vendorRes.vendors || vendorRes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [moduleFilters, procFilters]);

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
    load();
  }, [subscriptionChecked, hasAccess, load]);

  const openCreate = () => {
    const defaultStage = config?.procurementLifecycleStages?.find((s) => s.isDefault)?.id || 'planned';
    const defaultPayment = config?.procurementPaymentStatuses?.find((s) => s.isDefault)?.id || 'unpaid';
    setEditing(null);
    setForm({ ...EMPTY_FORM, lifecycleStage: defaultStage, paymentStatus: defaultPayment });
    setShowModal(true);
  };

  const openEdit = (record: Procurement) => {
    setEditing(record);
    setForm({
      purchaseOrderNumber: record.purchaseOrderNumber || '',
      invoiceNumber: record.invoiceNumber || '',
      vendorId: refId(record.vendorId),
      purchaseDate: record.purchaseDate ? record.purchaseDate.slice(0, 10) : '',
      budgetId: refId(record.budgetId),
      departmentId: refId(record.departmentId),
      amount: String(record.amount ?? ''),
      tax: String(record.tax ?? ''),
      discount: String(record.discount ?? ''),
      shipping: String(record.shipping ?? ''),
      lifecycleStage: record.lifecycleStage,
      paymentStatus: record.paymentStatus,
      fundingSourceId: record.fundingSourceId || '',
      costCenter: record.costCenter || '',
      project: record.project || '',
      notes: record.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        purchaseOrderNumber: form.purchaseOrderNumber.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        vendorId: form.vendorId || undefined,
        purchaseDate: form.purchaseDate || undefined,
        budgetId: form.budgetId || undefined,
        departmentId: form.departmentId || undefined,
        amount: Number(form.amount) || 0,
        tax: Number(form.tax) || 0,
        discount: Number(form.discount) || 0,
        shipping: Number(form.shipping) || 0,
        lifecycleStage: form.lifecycleStage,
        paymentStatus: form.paymentStatus,
        fundingSourceId: form.fundingSourceId || undefined,
        costCenter: form.costCenter.trim(),
        project: form.project.trim(),
        notes: form.notes,
      };
      if (editing) {
        const { changes } = await updateProcurement(editing._id, payload);
        setLastChanges(changes.length ? changes : null);
      } else {
        await createProcurement(payload);
        setLastChanges(null);
      }
      setShowModal(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: Procurement) => {
    if (!confirm(`Delete procurement ${record.purchaseId}?`)) return;
    try {
      await deleteProcurement(record._id);
      if (detailId === record._id) setDetailId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (!subscriptionChecked) return <LoadingSpinner message="Checking subscription…" />;
  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-4">Procurement</h1>
        <UpgradePrompt feature="Budgets & Procurement" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Budgets & Procurement</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track purchases from planning through asset creation.</p>
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
              + New purchase
            </button>
          )}
        </div>
      </div>

      <BudgetModuleNav />

      {lastChanges?.length ? (
        <FieldChangesAlert
          title="Procurement updated — changes saved"
          changes={lastChanges}
          onDismiss={() => setLastChanges(null)}
        />
      ) : null}

      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase">Planned</p>
            <p className="text-base font-semibold text-gray-300">{formatBudgetCurrency(summary.plannedSpend)}</p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase">Committed</p>
            <p className="text-base font-semibold text-blue-300">{formatBudgetCurrency(summary.committedSpend)}</p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase">Actual</p>
            <p className="text-base font-semibold text-emerald-300">{formatBudgetCurrency(summary.actualSpend)}</p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase">Records</p>
            <p className="text-base font-semibold text-gray-100">{summary.totalRecords}</p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase">Pending</p>
            <p className="text-base font-semibold text-amber-300">{summary.pendingCount}</p>
          </div>
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
          departments,
          locations: [],
          users: [],
          vendors,
          financialYears: Array.from(new Set(budgets.map((b) => b.financialYear).filter(Boolean) as string[])).sort().reverse(),
          projects: Array.from(new Set(records.map((r) => r.project).filter(Boolean) as string[])),
          costCenters: Array.from(new Set(records.map((r) => r.costCenter).filter(Boolean) as string[])),
          categories: Array.from(new Set(budgets.map((b) => b.dimensions?.category).filter((c): c is string => Boolean(c)))),
          lifecycleStages: config?.procurementLifecycleStages || [],
          paymentStatuses: config?.procurementPaymentStatuses || [],
        }}
        extra={
          <>
            <div>
              <label className={labelClass}>Lifecycle</label>
              <select
                className={inputClass}
                value={procFilters.lifecycleStage}
                onChange={(e) => setProcFilters((f) => ({ ...f, lifecycleStage: e.target.value }))}
              >
                <option value="">All</option>
                {(config?.procurementLifecycleStages || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Payment</label>
              <select
                className={inputClass}
                value={procFilters.paymentStatus}
                onChange={(e) => setProcFilters((f) => ({ ...f, paymentStatus: e.target.value }))}
              >
                <option value="">All</option>
                {(config?.procurementPaymentStatuses || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </>
        }
      />

      {loading ? (
        <LoadingSpinner message="Loading procurement…" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          <div className="overflow-x-auto rounded-xl border border-gray-800/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-800/80">
                  <th className="px-3 py-2">Purchase</th>
                  <th className="px-3 py-2">Vendor</th>
                  <th className="px-3 py-2">Budget</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Lifecycle</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-gray-500">No procurement records</td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr
                      key={r._id}
                      className={`border-b border-gray-800/40 cursor-pointer ${detailId === r._id ? 'bg-blue-500/10' : 'hover:bg-gray-800/30'}`}
                      onClick={() => setDetailId(r._id)}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-100">{r.purchaseId}</p>
                        {r.purchaseOrderNumber ? <p className="text-[11px] text-gray-500">PO: {r.purchaseOrderNumber}</p> : null}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400">
                        {typeof r.vendorId === 'object' && r.vendorId ? r.vendorId.name : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">
                        {typeof r.budgetId === 'object' && r.budgetId ? r.budgetId.name : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-200">{formatBudgetCurrency(r.totalCost)}</td>
                      <td className="px-3 py-2.5">{stageBadge(r.lifecycleStage, config?.procurementLifecycleStages || [])}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-400">{r.paymentStatus}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <div className="flex gap-1 justify-end">
                            <button type="button" onClick={() => openEdit(r)} className="text-[11px] text-blue-400 hover:underline">Edit</button>
                            <button type="button" onClick={() => handleDelete(r)} className="text-[11px] text-red-400 hover:underline">Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-gray-800/80 bg-gray-900/20 p-3 min-h-[280px]">
            {!detail ? (
              <p className="text-sm text-gray-500 text-center py-12">Select a record for details</p>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <h2 className="text-base font-semibold text-gray-100">{detail.purchaseId}</h2>
                  <p className="text-gray-500 mt-1">{detail.notes || 'No notes'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-gray-600">Amount</p><p className="text-gray-200">{formatBudgetCurrency(detail.amount)}</p></div>
                  <div><p className="text-gray-600">Total</p><p className="text-gray-200 font-medium">{formatBudgetCurrency(detail.totalCost)}</p></div>
                  <div><p className="text-gray-600">PO</p><p className="text-gray-200">{detail.purchaseOrderNumber || '—'}</p></div>
                  <div><p className="text-gray-600">Invoice</p><p className="text-gray-200">{detail.invoiceNumber || '—'}</p></div>
                </div>
                {detail.assetIds && detail.assetIds.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase text-gray-500 mb-1">Linked assets</p>
                    <ul className="space-y-1">
                      {detail.assetIds.map((a) => (
                        <li key={a._id}>
                          <Link href={`/dashboard/assets/${a._id}`} className="text-blue-400 hover:underline no-underline">
                            {a.assetId} — {a.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && config && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700/60 bg-gray-900 shadow-xl">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-gray-800/80 bg-gray-900/95">
              <h2 className="text-base font-semibold text-gray-100">{editing ? 'Edit purchase' : 'New purchase'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelClass}>PO number</label><input className={inputClass} value={form.purchaseOrderNumber} onChange={(e) => setForm((f) => ({ ...f, purchaseOrderNumber: e.target.value }))} /></div>
              <div><label className={labelClass}>Invoice number</label><input className={inputClass} value={form.invoiceNumber} onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))} /></div>
              <div><label className={labelClass}>Vendor</label>
                <select className={inputClass} value={form.vendorId} onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {vendors.map((v) => <option key={v._id} value={v._id}>{v.vendorId ? `${v.vendorId} — ` : ''}{v.name}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Purchase date</label><input type="date" className={inputClass} value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Budget</label>
                <select className={inputClass} value={form.budgetId} onChange={(e) => setForm((f) => ({ ...f, budgetId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {budgets.map((b) => <option key={b._id} value={b._id}>{b.name}{b.code ? ` (${b.code})` : ''}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Department</label>
                <select className={inputClass} value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Funding source</label>
                <select className={inputClass} value={form.fundingSourceId} onChange={(e) => setForm((f) => ({ ...f, fundingSourceId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {config.fundingSources.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Amount</label><input type="number" min={0} className={inputClass} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
              <div><label className={labelClass}>Tax</label><input type="number" min={0} className={inputClass} value={form.tax} onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value }))} /></div>
              <div><label className={labelClass}>Discount</label><input type="number" min={0} className={inputClass} value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} /></div>
              <div><label className={labelClass}>Shipping</label><input type="number" min={0} className={inputClass} value={form.shipping} onChange={(e) => setForm((f) => ({ ...f, shipping: e.target.value }))} /></div>
              <div className="sm:col-span-2 px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-700/40">
                <span className="text-xs text-gray-500">Total cost: </span>
                <span className="text-sm font-semibold text-gray-100">{formatBudgetCurrency(computedTotal)}</span>
              </div>
              <div><label className={labelClass}>Lifecycle stage</label>
                <select className={inputClass} value={form.lifecycleStage} onChange={(e) => setForm((f) => ({ ...f, lifecycleStage: e.target.value }))}>
                  {(config.procurementLifecycleStages || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Payment status</label>
                <select className={inputClass} value={form.paymentStatus} onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value }))}>
                  {(config.procurementPaymentStatuses || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Cost center</label><input className={inputClass} value={form.costCenter} onChange={(e) => setForm((f) => ({ ...f, costCenter: e.target.value }))} /></div>
              <div><label className={labelClass}>Project</label><input className={inputClass} value={form.project} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))} /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Notes</label><textarea className={`${inputClass} min-h-[72px]`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 px-4 py-3 border-t border-gray-800/80 bg-gray-900/95">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-1.5 text-sm rounded-lg border border-gray-700/60 text-gray-300">Cancel</button>
              <button type="button" disabled={saving} onClick={handleSave} className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
