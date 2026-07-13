'use client';

import type { KpiWidget, KpiFilterFieldKey, KpiWidgetFilters } from '@/lib/kpiWidgets';
import { formatAssetStatusLabel } from '@/lib/assetStatuses';
import { WIDGET_FILTER_CATALOG } from '@/lib/kpiWidgets';
import { AUDIT_RESOURCE_LABELS } from '@/lib/auditLabels';

const inputClass = 'px-1.5 py-0.5 text-[10px] border border-gray-700/60 rounded-md bg-gray-800/60 text-gray-200 min-w-0 w-full max-w-full';
const CONDITION_OPTIONS = ['excellent', 'good', 'fair', 'poor', 'critical', 'under_maintenance'];

export default function KpiWidgetFilters({
  widget,
  onChange,
  groups,
  templates,
  departments,
  locations,
  vendors,
  categories,
  users,
  statusOptions,
}: {
  widget: KpiWidget;
  onChange: (patch: Partial<KpiWidget>) => void;
  groups: { _id: string; name: string }[];
  templates: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  vendors: { _id: string; name: string }[];
  categories: string[];
  users: { _id: string; name: string }[];
  statusOptions: string[];
}) {
  const fields = widget.filterFields ?? [];
  const filters = widget.filters ?? {};
  const available = WIDGET_FILTER_CATALOG.filter((f) => !fields.includes(f.key));

  const setFilter = (key: keyof KpiWidgetFilters, value: string) => {
    onChange({ filters: { ...filters, [key]: value || undefined } });
  };

  const addField = (key: KpiFilterFieldKey) => {
    if (!key || fields.includes(key)) return;
    onChange({ filterFields: [...fields, key] });
  };

  const removeField = (key: KpiFilterFieldKey) => {
    const next = { ...filters };
    delete next[key];
    onChange({ filterFields: fields.filter((f) => f !== key), filters: next });
  };

  const renderField = (key: KpiFilterFieldKey) => {
    const label = WIDGET_FILTER_CATALOG.find((f) => f.key === key)?.label ?? key;
    const control = (() => {
      switch (key) {
        case 'dateFrom': case 'dateTo':
          return <input type="date" className={inputClass} value={filters[key] || ''} onChange={(e) => setFilter(key, e.target.value)} />;
        case 'departmentId':
          return <select className={inputClass} value={filters.departmentId || ''} onChange={(e) => setFilter('departmentId', e.target.value)}><option value="">All</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select>;
        case 'locationId':
          return <select className={inputClass} value={filters.locationId || ''} onChange={(e) => setFilter('locationId', e.target.value)}><option value="">All</option>{locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}</select>;
        case 'groupId':
          return <select className={inputClass} value={filters.groupId || ''} onChange={(e) => setFilter('groupId', e.target.value)}><option value="">All</option>{groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}</select>;
        case 'templateId':
          return <select className={inputClass} value={filters.templateId || ''} onChange={(e) => setFilter('templateId', e.target.value)}><option value="">All</option>{templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select>;
        case 'vendorId':
          return <select className={inputClass} value={filters.vendorId || ''} onChange={(e) => setFilter('vendorId', e.target.value)}><option value="">All</option>{vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}</select>;
        case 'status':
          return <select className={inputClass} value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value)}><option value="">All</option>{statusOptions.map((s) => <option key={s} value={s}>{formatAssetStatusLabel(s)}</option>)}</select>;
        case 'category':
          return <select className={inputClass} value={filters.category || ''} onChange={(e) => setFilter('category', e.target.value)}><option value="">All</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>;
        case 'condition':
          return <select className={inputClass} value={filters.condition || ''} onChange={(e) => setFilter('condition', e.target.value)}><option value="">All</option>{CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select>;
        case 'assignedUserId':
          return <select className={inputClass} value={filters.assignedUserId || ''} onChange={(e) => setFilter('assignedUserId', e.target.value)}><option value="">All</option>{users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select>;
        case 'purchaseYear':
          return <input type="number" className={inputClass} placeholder="Year" value={filters.purchaseYear || ''} onChange={(e) => setFilter('purchaseYear', e.target.value)} />;
        case 'warrantyStatus':
          return <select className={inputClass} value={filters.warrantyStatus || ''} onChange={(e) => setFilter('warrantyStatus', e.target.value)}><option value="">All</option><option value="active">Active</option><option value="expiring">Expiring</option><option value="expired">Expired</option></select>;
        case 'auditResource':
          return (
            <select className={inputClass} value={filters.auditResource || ''} onChange={(e) => setFilter('auditResource', e.target.value)}>
              <option value="">All resources</option>
              {Object.entries(AUDIT_RESOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          );
        default: return null;
      }
    })();

    return (
      <div key={key} className="flex flex-col gap-0.5 min-w-0 w-[calc(50%-4px)]">
        <div className="flex justify-between gap-1"><span className="text-[9px] text-gray-500 truncate">{label}</span><button type="button" onClick={() => removeField(key)} className="text-gray-600 hover:text-red-400 text-[10px]">×</button></div>
        {control}
      </div>
    );
  };

  return (
    <div className="relative z-20 mb-2 shrink-0 min-w-0 max-w-full">
      <div className="flex flex-wrap items-end gap-1.5">
        {fields.map(renderField)}
        {available.length > 0 && (
          <div className="shrink-0 min-w-[88px]">
            <label className="text-[9px] text-gray-600 block mb-0.5">Add filter</label>
            <select className={inputClass} value="" onChange={(e) => { const k = e.target.value as KpiFilterFieldKey; if (k) addField(k); }}>
              <option value="">Choose…</option>
              {available.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
