'use client';

import { useMemo, useState } from 'react';
import type { BudgetModuleFilters } from '@/lib/budgetModuleFilters';
import { BUDGET_MODULE_FILTER_FIELDS } from '@/lib/budgetModuleFilters';

const inputClass =
  'px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 min-w-[120px]';

export type BudgetModuleFilterLookups = {
  budgets?: { _id: string; name: string }[];
  budgetTypes: { id: string; name: string }[];
  budgetStatuses: { id: string; name: string }[];
  fundingSources: { id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  users: { _id: string; name: string }[];
  vendors?: { _id: string; name: string }[];
  financialYears: string[];
  projects?: string[];
  costCenters?: string[];
};

type Props = {
  filters: BudgetModuleFilters;
  onChange: (patch: BudgetModuleFilters | ((prev: BudgetModuleFilters) => BudgetModuleFilters)) => void;
  onClear: () => void;
  lookups: BudgetModuleFilterLookups;
  showSearch?: boolean;
  extra?: React.ReactNode;
};

export default function BudgetModuleFiltersBar({
  filters,
  onChange,
  onClear,
  lookups,
  showSearch = true,
  extra,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = useMemo(
    () => Object.entries(filters).filter(([k, v]) => k !== 'search' && v != null && v !== '').length,
    [filters]
  );

  const setField = (key: keyof BudgetModuleFilters, value: string) => {
    onChange((prev) => {
      const next = { ...prev };
      if (!value) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const primaryFields: (keyof BudgetModuleFilters)[] = [
    'financialYear',
    'status',
    'budgetTypeId',
    'departmentId',
    'budgetId',
  ];

  const advancedFields = BUDGET_MODULE_FILTER_FIELDS.map((f) => f.key).filter(
    (k) => !primaryFields.includes(k)
  );

  const renderSelect = (
    key: keyof BudgetModuleFilters,
    label: string,
    options: { value: string; label: string }[]
  ) => (
    <div key={key}>
      <label className="text-[10px] text-gray-500 uppercase block mb-1">{label}</label>
      <select
        className={inputClass}
        value={filters[key] || ''}
        onChange={(e) => setField(key, e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const fieldControl = (key: keyof BudgetModuleFilters) => {
    const label = BUDGET_MODULE_FILTER_FIELDS.find((f) => f.key === key)?.label ?? key;
    switch (key) {
      case 'dateFrom':
      case 'dateTo':
        return (
          <div key={key}>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">{label}</label>
            <input
              type="date"
              className={inputClass}
              value={filters[key] || ''}
              onChange={(e) => setField(key, e.target.value)}
            />
          </div>
        );
      case 'financialYear':
        return renderSelect(
          key,
          label,
          lookups.financialYears.map((y) => ({ value: y, label: y }))
        );
      case 'status':
        return renderSelect(
          key,
          label,
          lookups.budgetStatuses.map((s) => ({ value: s.id, label: s.name }))
        );
      case 'budgetTypeId':
        return renderSelect(
          key,
          label,
          lookups.budgetTypes.map((t) => ({ value: t.id, label: t.name }))
        );
      case 'budgetId':
        return renderSelect(
          key,
          label,
          (lookups.budgets || []).map((b) => ({ value: b._id, label: b.name }))
        );
      case 'departmentId':
        return renderSelect(
          key,
          label,
          lookups.departments.map((d) => ({ value: d._id, label: d.name }))
        );
      case 'locationId':
        return renderSelect(
          key,
          label,
          lookups.locations.map((l) => ({ value: l._id, label: l.name }))
        );
      case 'fundingSourceId':
        return renderSelect(
          key,
          label,
          lookups.fundingSources.map((f) => ({ value: f.id, label: f.name }))
        );
      case 'budgetOwnerId':
        return renderSelect(
          key,
          label,
          lookups.users.map((u) => ({ value: u._id, label: u.name }))
        );
      case 'vendorId':
        return renderSelect(
          key,
          label,
          (lookups.vendors || []).map((v) => ({ value: v._id, label: v.name }))
        );
      case 'project':
        return renderSelect(
          key,
          label,
          (lookups.projects || []).map((p) => ({ value: p, label: p }))
        );
      case 'costCenter':
        return renderSelect(
          key,
          label,
          (lookups.costCenters || []).map((c) => ({ value: c, label: c }))
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2 p-3 rounded-xl border border-gray-800/80 bg-gray-900/20">
      <div className="flex flex-wrap gap-2 items-end">
        {showSearch && (
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Search</label>
            <input
              className={`${inputClass} w-full min-w-0`}
              placeholder="Search…"
              value={filters.search || ''}
              onChange={(e) => setField('search', e.target.value)}
            />
          </div>
        )}
        {primaryFields.map((k) => fieldControl(k))}
        {extra}
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="px-2 py-1 text-xs rounded-lg border border-gray-700/60 text-gray-400 hover:text-gray-200"
        >
          {expanded ? 'Less filters' : `More filters${activeCount ? ` (${activeCount})` : ''}`}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="px-2 py-1 text-xs rounded-lg border border-gray-700/60 text-red-400/80 hover:text-red-300"
          >
            Clear all
          </button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-wrap gap-2 items-end pt-1 border-t border-gray-800/60">
          {advancedFields.map((k) => fieldControl(k))}
        </div>
      )}
    </div>
  );
}
