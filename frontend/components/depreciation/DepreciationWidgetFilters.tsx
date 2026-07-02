'use client';

import type { DepreciationPolicy } from '@/lib/depreciation';
import { formatAssetStatusLabel } from '@/lib/assetStatuses';
import {
  WIDGET_FILTER_CATALOG,
  type DepreciationWidget,
  type WidgetFilterFieldKey,
  type WidgetFilters,
} from '@/lib/depreciationWidgets';

const inputClass =
  'px-1.5 py-0.5 text-[10px] border border-gray-700/60 rounded-md bg-gray-800/60 text-gray-200 min-w-0 w-full max-w-full';

export default function DepreciationWidgetFilters({
  widget,
  onChange,
  groups,
  templates,
  departments,
  locations,
  vendors,
  policies,
  categories,
  statusOptions,
}: {
  widget: DepreciationWidget;
  onChange: (patch: Partial<DepreciationWidget>) => void;
  groups: { _id: string; name: string }[];
  templates: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  vendors: { _id: string; name: string }[];
  policies: DepreciationPolicy[];
  categories: string[];
  statusOptions: string[];
}) {
  const fields = widget.filterFields ?? [];
  const available = WIDGET_FILTER_CATALOG.filter((f) => !fields.includes(f.key));

  const setFilter = (key: keyof WidgetFilters, value: string) => {
    onChange({
      filters: { ...widget.filters, [key]: value || undefined },
    });
  };

  const addField = (key: WidgetFilterFieldKey) => {
    if (!key || fields.includes(key)) return;
    onChange({ filterFields: [...fields, key] });
  };

  const removeField = (key: WidgetFilterFieldKey) => {
    const nextFilters = { ...widget.filters };
    delete nextFilters[key];
    onChange({
      filterFields: fields.filter((f) => f !== key),
      filters: nextFilters,
    });
  };

  const renderField = (key: WidgetFilterFieldKey) => {
    const meta = WIDGET_FILTER_CATALOG.find((f) => f.key === key);
    const label = meta?.label ?? key;

    const control = (() => {
      switch (key) {
        case 'dateFrom':
        case 'dateTo':
          return (
            <input
              type="date"
              className={inputClass}
              value={widget.filters[key] || ''}
              onChange={(e) => setFilter(key, e.target.value)}
            />
          );
        case 'departmentId':
          return (
            <select className={inputClass} value={widget.filters.departmentId || ''} onChange={(e) => setFilter('departmentId', e.target.value)}>
              <option value="">All</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          );
        case 'locationId':
          return (
            <select className={inputClass} value={widget.filters.locationId || ''} onChange={(e) => setFilter('locationId', e.target.value)}>
              <option value="">All</option>
              {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          );
        case 'groupId':
          return (
            <select className={inputClass} value={widget.filters.groupId || ''} onChange={(e) => setFilter('groupId', e.target.value)}>
              <option value="">All</option>
              {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          );
        case 'templateId':
          return (
            <select className={inputClass} value={widget.filters.templateId || ''} onChange={(e) => setFilter('templateId', e.target.value)}>
              <option value="">All</option>
              {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          );
        case 'vendorId':
          return (
            <select className={inputClass} value={widget.filters.vendorId || ''} onChange={(e) => setFilter('vendorId', e.target.value)}>
              <option value="">All</option>
              {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select>
          );
        case 'status':
          return (
            <select className={inputClass} value={widget.filters.status || ''} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">All</option>
              {statusOptions.map((s) => <option key={s} value={s}>{formatAssetStatusLabel(s)}</option>)}
            </select>
          );
        case 'category':
          return (
            <select className={inputClass} value={widget.filters.category || ''} onChange={(e) => setFilter('category', e.target.value)}>
              <option value="">All</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          );
        case 'policyId':
          return (
            <select className={inputClass} value={widget.filters.policyId || ''} onChange={(e) => setFilter('policyId', e.target.value)}>
              <option value="">All</option>
              {policies.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          );
        case 'method':
          return (
            <select className={inputClass} value={widget.filters.method || ''} onChange={(e) => setFilter('method', e.target.value)}>
              <option value="">All</option>
              <option value="SLM">SLM</option>
              <option value="WDV">WDV</option>
            </select>
          );
        case 'purchaseYear':
          return (
            <input
              type="number"
              className={inputClass}
              placeholder="Year"
              value={widget.filters.purchaseYear || ''}
              onChange={(e) => setFilter('purchaseYear', e.target.value)}
            />
          );
        case 'warrantyStatus':
          return (
            <select className={inputClass} value={widget.filters.warrantyStatus || ''} onChange={(e) => setFilter('warrantyStatus', e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="expiring">Expiring</option>
              <option value="expired">Expired</option>
            </select>
          );
        default:
          return null;
      }
    })();

    return (
      <div key={key} className="flex flex-col gap-0.5 min-w-0 w-[calc(50%-4px)]">
        <div className="flex items-center justify-between gap-0.5 min-w-0">
          <span className="text-[9px] text-gray-500 truncate" title={label}>{label}</span>
          <button
            type="button"
            onClick={() => removeField(key)}
            className="text-gray-600 hover:text-red-400 text-[10px] leading-none shrink-0"
            title="Remove filter"
          >
            ×
          </button>
        </div>
        {control}
      </div>
    );
  };

  return (
    <div className="relative z-20 mb-2 shrink-0 min-w-0 max-w-full">
      <div className="flex flex-wrap items-end gap-1.5 max-w-full">
        {fields.map(renderField)}
        {available.length > 0 && (
          <div className="shrink-0 min-w-[88px]">
            <label className="text-[9px] text-gray-600 block mb-0.5">Add filter</label>
            <select
              className={inputClass}
              value=""
              onChange={(e) => {
                const key = e.target.value as WidgetFilterFieldKey;
                if (key) addField(key);
              }}
            >
              <option value="">Choose…</option>
              {available.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
