'use client';

import type { PartnerFilterFieldKey, PartnerWidget, PartnerWidgetFilters } from '@/lib/partnerDashboardWidgets';
import { PARTNER_WIDGET_FILTER_CATALOG } from '@/lib/partnerDashboardWidgets';

const inputClass =
  'px-1.5 py-0.5 text-[10px] border border-gray-700/60 rounded-md bg-gray-800/60 text-gray-200 min-w-0 w-full max-w-full';

export default function PartnerWidgetFilters({
  widget,
  onChange,
  statuses,
  partnerTypes,
  categories,
  tags = [],
}: {
  widget: PartnerWidget;
  onChange: (patch: Partial<PartnerWidget>) => void;
  statuses: { id: string; name: string }[];
  partnerTypes: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  tags?: string[];
}) {
  const fields = widget.filterFields ?? [];
  const filters = widget.filters ?? {};
  const available = PARTNER_WIDGET_FILTER_CATALOG.filter((f) => !fields.includes(f.key));

  const setFilter = (key: keyof PartnerWidgetFilters, value: string) => {
    onChange({ filters: { ...filters, [key]: value || undefined } });
  };

  const addField = (key: PartnerFilterFieldKey) => {
    if (!key || fields.includes(key)) return;
    onChange({ filterFields: [...fields, key] });
  };

  const removeField = (key: PartnerFilterFieldKey) => {
    const next = { ...filters };
    delete next[key];
    onChange({ filterFields: fields.filter((f) => f !== key), filters: next });
  };

  const renderField = (key: PartnerFilterFieldKey) => {
    const label = PARTNER_WIDGET_FILTER_CATALOG.find((f) => f.key === key)?.label ?? key;
    let control = null;
    if (key === 'status') {
      control = (
        <select className={inputClass} value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      );
    } else if (key === 'partnerTypeKey') {
      control = (
        <select
          className={inputClass}
          value={filters.partnerTypeKey || ''}
          onChange={(e) => setFilter('partnerTypeKey', e.target.value)}
        >
          <option value="">All</option>
          {partnerTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      );
    } else if (key === 'categoryKey') {
      control = (
        <select
          className={inputClass}
          value={filters.categoryKey || ''}
          onChange={(e) => setFilter('categoryKey', e.target.value)}
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      );
    } else if (key === 'tag') {
      control = (
        <select className={inputClass} value={filters.tag || ''} onChange={(e) => setFilter('tag', e.target.value)}>
          <option value="">All</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      );
    } else if (key === 'search') {
      control = (
        <input
          className={inputClass}
          value={filters.search || ''}
          onChange={(e) => setFilter('search', e.target.value)}
          placeholder="Name / code"
        />
      );
    }

    return (
      <div key={key} className="flex flex-col gap-0.5 min-w-0 w-[calc(50%-4px)]">
        <div className="flex justify-between gap-1">
          <span className="text-[9px] text-gray-500 truncate">{label}</span>
          <button type="button" onClick={() => removeField(key)} className="text-gray-600 hover:text-red-400 text-[10px]">
            ×
          </button>
        </div>
        {control}
      </div>
    );
  };

  return (
    <div className="mb-2 shrink-0">
      {fields.length > 0 && <div className="flex flex-wrap gap-2 mb-1.5">{fields.map(renderField)}</div>}
      {available.length > 0 && (
        <select
          className={`${inputClass} max-w-[140px] text-gray-500`}
          value=""
          onChange={(e) => addField(e.target.value as PartnerFilterFieldKey)}
        >
          <option value="">+ Filter</option>
          {available.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
