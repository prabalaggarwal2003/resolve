'use client';

import type { HealthWidget, HealthFilterFieldKey, HealthWidgetFilters } from '@/lib/assetHealthWidgets';
import { HEALTH_WIDGET_FILTER_CATALOG, HEALTH_LEVEL_FILTER_OPTIONS } from '@/lib/assetHealthWidgets';
import { formatAssetStatusLabel } from '@/lib/assetStatuses';

const inputClass = 'px-1.5 py-0.5 text-[10px] border border-gray-700/60 rounded-md bg-gray-800/60 text-gray-200 min-w-0 w-full max-w-full';
const CONDITION_OPTIONS = ['excellent', 'good', 'fair', 'poor', 'critical', 'under_maintenance'];

export default function AssetHealthWidgetFilters({
  widget,
  onChange,
  groups,
  departments,
  locations,
  categories,
  statusOptions,
}: {
  widget: HealthWidget;
  onChange: (patch: Partial<HealthWidget>) => void;
  groups: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  categories: string[];
  statusOptions: string[];
}) {
  const fields = widget.filterFields ?? [];
  const filters = widget.filters ?? {};
  const available = HEALTH_WIDGET_FILTER_CATALOG.filter((f) => !fields.includes(f.key));

  const setFilter = (key: keyof HealthWidgetFilters, value: string) => {
    onChange({ filters: { ...filters, [key]: value || undefined } });
  };

  const addField = (key: HealthFilterFieldKey) => {
    if (!key || fields.includes(key)) return;
    onChange({ filterFields: [...fields, key] });
  };

  const removeField = (key: HealthFilterFieldKey) => {
    const next = { ...filters };
    delete next[key];
    onChange({ filterFields: fields.filter((f) => f !== key), filters: next });
  };

  const renderField = (key: HealthFilterFieldKey) => {
    const label = HEALTH_WIDGET_FILTER_CATALOG.find((f) => f.key === key)?.label ?? key;
    const control = (() => {
      switch (key) {
        case 'departmentId':
          return <select className={inputClass} value={filters.departmentId || ''} onChange={(e) => setFilter('departmentId', e.target.value)}><option value="">All</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select>;
        case 'locationId':
          return <select className={inputClass} value={filters.locationId || ''} onChange={(e) => setFilter('locationId', e.target.value)}><option value="">All</option>{locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}</select>;
        case 'groupId':
          return <select className={inputClass} value={filters.groupId || ''} onChange={(e) => setFilter('groupId', e.target.value)}><option value="">All</option>{groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}</select>;
        case 'status':
          return <select className={inputClass} value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value)}><option value="">All</option>{statusOptions.map((s) => <option key={s} value={s}>{formatAssetStatusLabel(s)}</option>)}</select>;
        case 'category':
          return <select className={inputClass} value={filters.category || ''} onChange={(e) => setFilter('category', e.target.value)}><option value="">All</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>;
        case 'condition':
          return <select className={inputClass} value={filters.condition || ''} onChange={(e) => setFilter('condition', e.target.value)}><option value="">All</option>{CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select>;
        case 'healthLevel':
          return (
            <select className={inputClass} value={filters.healthLevel || ''} onChange={(e) => setFilter('healthLevel', e.target.value)}>
              <option value="">All</option>
              {HEALTH_LEVEL_FILTER_OPTIONS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
            </select>
          );
        case 'healthScoreMin':
          return (
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              placeholder="0"
              value={filters.healthScoreMin || ''}
              onChange={(e) => setFilter('healthScoreMin', e.target.value)}
            />
          );
        case 'healthScoreMax':
          return (
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              placeholder="100"
              value={filters.healthScoreMax || ''}
              onChange={(e) => setFilter('healthScoreMax', e.target.value)}
            />
          );
        default:
          return null;
      }
    })();

    return (
      <div key={key} className="flex flex-col gap-0.5 min-w-0 w-[calc(50%-4px)]">
        <div className="flex justify-between gap-1">
          <span className="text-[9px] text-gray-500 truncate">{label}</span>
          <button type="button" onClick={() => removeField(key)} className="text-gray-600 hover:text-red-400 text-[10px]">×</button>
        </div>
        {control}
      </div>
    );
  };

  const filterCategories = Array.from(new Set(HEALTH_WIDGET_FILTER_CATALOG.map((f) => f.category)));

  return (
    <div className="relative z-20 mb-2 shrink-0 min-w-0 max-w-full">
      <div className="flex flex-wrap items-end gap-1.5">
        {fields.map(renderField)}
        {available.length > 0 && (
          <div className="shrink-0 min-w-[88px]">
            <label className="text-[9px] text-gray-600 block mb-0.5">Add filter</label>
            <select className={inputClass} value="" onChange={(e) => { const k = e.target.value as HealthFilterFieldKey; if (k) addField(k); }}>
              <option value="">Choose…</option>
              {filterCategories.map((category) => (
                <optgroup key={category} label={category}>
                  {available.filter((f) => f.category === category).map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
