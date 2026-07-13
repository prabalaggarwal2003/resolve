'use client';

import type { BudgetWidget, BudgetFilterFieldKey, BudgetWidgetFilters } from '@/lib/budgetWidgets';
import { WIDGET_FILTER_CATALOG } from '@/lib/budgetWidgets';

const inputClass = 'px-1.5 py-0.5 text-[10px] border border-gray-700/60 rounded-md bg-gray-800/60 text-gray-200 min-w-0 w-full max-w-full';

export default function BudgetWidgetFilters({
  widget,
  onChange,
  departments,
  locations,
  users,
  budgetTypes,
  budgetStatuses,
  financialYears,
  fundingSources = [],
  budgets = [],
  vendors = [],
  projects = [],
  costCenters = [],
  categories = [],
  lifecycleStages = [],
  paymentStatuses = [],
}: {
  widget: BudgetWidget;
  onChange: (patch: Partial<BudgetWidget>) => void;
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  users: { _id: string; name: string }[];
  budgetTypes: { id: string; name: string }[];
  budgetStatuses: { id: string; name: string }[];
  financialYears: string[];
  fundingSources?: { id: string; name: string }[];
  budgets?: { _id: string; name: string }[];
  vendors?: { _id: string; name: string }[];
  projects?: string[];
  costCenters?: string[];
  categories?: string[];
  lifecycleStages?: { id: string; name: string }[];
  paymentStatuses?: { id: string; name: string }[];
}) {
  const fields = widget.filterFields ?? [];
  const filters = widget.filters ?? {};
  const available = WIDGET_FILTER_CATALOG.filter((f) => !fields.includes(f.key));

  const setFilter = (key: keyof BudgetWidgetFilters, value: string) => {
    onChange({ filters: { ...filters, [key]: value || undefined } });
  };

  const addField = (key: BudgetFilterFieldKey) => {
    if (!key || fields.includes(key)) return;
    onChange({ filterFields: [...fields, key] });
  };

  const removeField = (key: BudgetFilterFieldKey) => {
    const next = { ...filters };
    delete next[key];
    onChange({ filterFields: fields.filter((f) => f !== key), filters: next });
  };

  const renderField = (key: BudgetFilterFieldKey) => {
    const label = WIDGET_FILTER_CATALOG.find((f) => f.key === key)?.label ?? key;
    const control = (() => {
      switch (key) {
        case 'dateFrom':
        case 'dateTo':
          return <input type="date" className={inputClass} value={filters[key] || ''} onChange={(e) => setFilter(key, e.target.value)} />;
        case 'financialYear':
          return (
            <select className={inputClass} value={filters.financialYear || ''} onChange={(e) => setFilter('financialYear', e.target.value)}>
              <option value="">All</option>
              {financialYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          );
        case 'status':
          return (
            <select className={inputClass} value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">All</option>
              {budgetStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          );
        case 'budgetTypeId':
          return (
            <select className={inputClass} value={filters.budgetTypeId || ''} onChange={(e) => setFilter('budgetTypeId', e.target.value)}>
              <option value="">All</option>
              {budgetTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          );
        case 'budgetId':
          return (
            <select className={inputClass} value={filters.budgetId || ''} onChange={(e) => setFilter('budgetId', e.target.value)}>
              <option value="">All</option>
              {budgets.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          );
        case 'departmentId':
          return (
            <select className={inputClass} value={filters.departmentId || ''} onChange={(e) => setFilter('departmentId', e.target.value)}>
              <option value="">All</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          );
        case 'locationId':
          return (
            <select className={inputClass} value={filters.locationId || ''} onChange={(e) => setFilter('locationId', e.target.value)}>
              <option value="">All</option>
              {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          );
        case 'budgetOwnerId':
          return (
            <select className={inputClass} value={filters.budgetOwnerId || ''} onChange={(e) => setFilter('budgetOwnerId', e.target.value)}>
              <option value="">All</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          );
        case 'fundingSourceId':
          return (
            <select className={inputClass} value={filters.fundingSourceId || ''} onChange={(e) => setFilter('fundingSourceId', e.target.value)}>
              <option value="">All</option>
              {(fundingSources || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          );
        case 'vendorId':
          return (
            <select className={inputClass} value={filters.vendorId || ''} onChange={(e) => setFilter('vendorId', e.target.value)}>
              <option value="">All</option>
              {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select>
          );
        case 'project':
          return (
            <select className={inputClass} value={filters.project || ''} onChange={(e) => setFilter('project', e.target.value)}>
              <option value="">All</option>
              {projects.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          );
        case 'costCenter':
          return (
            <select className={inputClass} value={filters.costCenter || ''} onChange={(e) => setFilter('costCenter', e.target.value)}>
              <option value="">All</option>
              {costCenters.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          );
        case 'category':
          return (
            <select className={inputClass} value={filters.category || ''} onChange={(e) => setFilter('category', e.target.value)}>
              <option value="">All</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          );
        case 'lifecycleStage':
          return (
            <select className={inputClass} value={filters.lifecycleStage || ''} onChange={(e) => setFilter('lifecycleStage', e.target.value)}>
              <option value="">All</option>
              {lifecycleStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          );
        case 'paymentStatus':
          return (
            <select className={inputClass} value={filters.paymentStatus || ''} onChange={(e) => setFilter('paymentStatus', e.target.value)}>
              <option value="">All</option>
              {paymentStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          );
        default:
          return null;
      }
    })();
    if (!control) return null;
    return (
      <div key={key} className="flex items-center gap-1 min-w-0">
        <span className="text-[9px] text-gray-600 shrink-0">{label}</span>
        <div className="flex-1 min-w-0">{control}</div>
        <button type="button" onClick={() => removeField(key)} className="text-gray-600 hover:text-red-400 text-[10px] shrink-0">×</button>
      </div>
    );
  };

  if (!fields.length && !available.length) return null;

  return (
    <div className="mb-1 shrink-0 space-y-1">
      {fields.map(renderField)}
      {available.length > 0 && (
        <select className={`${inputClass} max-w-[140px]`} value="" onChange={(e) => { addField(e.target.value as BudgetFilterFieldKey); e.target.value = ''; }}>
          <option value="">+ Filter</option>
          {available.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      )}
    </div>
  );
}
