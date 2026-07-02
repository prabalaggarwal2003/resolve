'use client';

import { useState } from 'react';
import ColumnCustomizer from '@/components/assets/ColumnCustomizer';
import {
  FILTER_FIELD_DEFS,
  OPERATORS_BY_TYPE,
  newFilter,
  newSavedView,
  STATUS_LABELS,
  SORT_OPTIONS,
  DEFAULT_BASIC_FILTERS,
  hasActiveBasicFilters,
  normalizeBasicFilters,
  type AdvancedFilter,
  type AssetListPreferences,
  type SavedView,
  type FilterFieldDef,
} from '@/lib/assetsTableConfig';
import LocationTreePicker from '@/components/LocationTreePicker';
import type { LocationTreeNode } from '@/lib/locations';

const inputClass =
  'px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

export default function AssetsListToolbar({
  prefs,
  onUpdate,
  departments,
  locations,
  locationTree,
  assetGroups,
  vendors,
  users,
  categories = [],
  customFilterFields = [],
}: {
  prefs: AssetListPreferences;
  onUpdate: (patch: Partial<AssetListPreferences> | ((p: AssetListPreferences) => AssetListPreferences)) => void;
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  locationTree: LocationTreeNode[];
  assetGroups: { _id: string; name: string }[];
  vendors: { _id: string; vendorId: string; name: string }[];
  users: { _id: string; name: string }[];
  categories?: string[];
  customFilterFields?: { field: string; label: string; type: 'text' | 'number' | 'date' | 'select' }[];
}) {
  const [showColumns, setShowColumns] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [viewName, setViewName] = useState('');

  const reorderColumns = (columns: AssetListPreferences['columns']) => {
    onUpdate((p) => ({ ...p, activeViewId: null, columns }));
  };

  const updateFilter = (id: string, patch: Partial<AdvancedFilter>) => {
    onUpdate((p) => ({
      ...p,
      activeViewId: null,
      advancedFilters: p.advancedFilters.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  };

  const removeFilter = (id: string) => {
    onUpdate((p) => ({
      ...p,
      activeViewId: null,
      advancedFilters: p.advancedFilters.filter((f) => f.id !== id),
    }));
  };

  const applyView = (view: SavedView) => {
    onUpdate({
      activeViewId: view.id,
      columns: view.columns.map((c) => ({ ...c })),
      sort: view.sort,
      order: view.order,
      globalSearch: view.globalSearch,
      advancedFilters: view.advancedFilters.map((f) => ({ ...f })),
      basicFilters: view.basicFilters
      ? normalizeBasicFilters(view.basicFilters)
      : { ...DEFAULT_BASIC_FILTERS },
    });
    setShowViews(false);
  };

  const saveCurrentView = () => {
    const name = viewName.trim();
    if (!name) return;
    const view = newSavedView(name, prefs);
    onUpdate((p) => ({
      ...p,
      savedViews: [...p.savedViews, view],
      activeViewId: view.id,
    }));
    setViewName('');
    setShowViews(false);
  };

  const deleteView = (id: string) => {
    onUpdate((p) => ({
      ...p,
      savedViews: p.savedViews.filter((v) => v.id !== id),
      activeViewId: p.activeViewId === id ? null : p.activeViewId,
    }));
  };

  const referenceOptions = (field: string) => {
    if (field === 'locationId') return locations.map((l) => ({ value: l._id, label: l.name }));
    if (field === 'groupId') return assetGroups.map((g) => ({ value: g._id, label: g.name }));
    if (field === 'departmentId') return departments.map((d) => ({ value: d._id, label: d.name }));
    if (field === 'vendorId') return vendors.map((v) => ({ value: v._id, label: `${v.vendorId} — ${v.name}` }));
    if (field === 'assignedTo') return users.map((u) => ({ value: u._id, label: u.name }));
    return [];
  };

  const activeView = prefs.savedViews.find((v) => v.id === prefs.activeViewId);

  const allFilterFields: FilterFieldDef[] = [
    ...FILTER_FIELD_DEFS,
    ...customFilterFields.map((f) => ({
      field: f.field,
      label: f.label,
      type: f.type as FilterFieldDef['type'],
    })),
  ];

  const sortValue = `${prefs.sort}-${prefs.order}`;
  const hasBasicFilters = hasActiveBasicFilters(prefs.basicFilters);

  const basicFilters = normalizeBasicFilters(prefs.basicFilters);

  const setBasicFilter = <K extends keyof typeof DEFAULT_BASIC_FILTERS>(
    key: K,
    value: (typeof DEFAULT_BASIC_FILTERS)[K]
  ) => {
    onUpdate((p) => ({
      ...p,
      activeViewId: null,
      basicFilters: { ...normalizeBasicFilters(p.basicFilters), [key]: value },
    }));
  };

  return (
    <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gray-800/40 px-4 py-4 mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search anything — ID, name, serial, tags, assignee…"
          value={prefs.globalSearch}
          onChange={(e) => onUpdate({ globalSearch: e.target.value, activeViewId: null })}
          className={`${inputClass} flex-1 min-w-[200px]`}
        />
        <select
          value={sortValue}
          onChange={(e) => {
            const opt = SORT_OPTIONS.find((o) => o.value === e.target.value);
            if (opt) onUpdate({ sort: opt.sort, order: opt.order, activeViewId: null });
          }}
          className={`${inputClass} min-w-[180px]`}
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className={`${buttonClass} border-violet-500/40 ${showFilters || prefs.advancedFilters.length ? 'bg-violet-500/15 text-violet-300' : 'text-gray-400'}`}
        >
          More filters{prefs.advancedFilters.length ? ` (${prefs.advancedFilters.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setShowColumns((s) => !s)}
          className={`${buttonClass} border-gray-700/60 text-gray-400 hover:text-gray-200`}
        >
          Columns
        </button>
        <button
          type="button"
          onClick={() => setShowViews((s) => !s)}
          className={`${buttonClass} border-gray-700/60 text-gray-400 hover:text-gray-200`}
        >
          Views{activeView ? `: ${activeView.name}` : ''}
        </button>
        {(prefs.globalSearch || prefs.advancedFilters.length > 0 || hasBasicFilters || prefs.activeViewId) && (
          <button
            type="button"
            onClick={() =>
              onUpdate({
                globalSearch: '',
                advancedFilters: [],
                basicFilters: { ...DEFAULT_BASIC_FILTERS },
                activeViewId: null,
              })
            }
            className={`${buttonClass} border-red-500/30 text-red-300`}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-700/50 bg-gray-900/30 p-3">
        <p className="text-[10px] font-semibold text-violet-400/80 uppercase tracking-widest mb-2">Filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Asset group</label>
            <select
              value={basicFilters.groupId}
              onChange={(e) => setBasicFilter('groupId', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">All groups</option>
              {assetGroups.map((g) => (
                <option key={g._id} value={g._id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Status</label>
            <select
              value={basicFilters.status}
              onChange={(e) => setBasicFilter('status', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Category</label>
            <select
              value={basicFilters.category}
              onChange={(e) => setBasicFilter('category', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Department</label>
            <select
              value={basicFilters.departmentId}
              onChange={(e) => setBasicFilter('departmentId', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-700/40">
          <LocationTreePicker
            tree={locationTree}
            multiple
            value={basicFilters.locationIds}
            onChange={(ids) => setBasicFilter('locationIds', ids)}
            label="Location"
            compact
            hideHint
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={basicFilters.locationIncludeChildren}
              onChange={(e) => setBasicFilter('locationIncludeChildren', e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/40"
            />
            Include child locations
          </label>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-lg border border-gray-700/50 bg-gray-900/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Advanced filters</p>
            <button
              type="button"
              onClick={() =>
                onUpdate((p) => ({
                  ...p,
                  activeViewId: null,
                  advancedFilters: [...p.advancedFilters, newFilter()],
                }))
              }
              className={`${buttonClass} border-violet-500/40 text-violet-300`}
            >
              + Add filter
            </button>
          </div>
          {prefs.advancedFilters.length === 0 && (
            <p className="text-xs text-gray-500">No filters. Add rules based on any asset field.</p>
          )}
          {prefs.advancedFilters.map((f) => {
            const def = allFilterFields.find((d) => d.field === f.field) || allFilterFields[0];
            const ops = OPERATORS_BY_TYPE[def.type];
            const operatorValid = ops.some((o) => o.value === f.operator);
            const effectiveOperator = operatorValid ? f.operator : ops[0].value;
            const needsValue = !['empty', 'not_empty'].includes(effectiveOperator);
            return (
              <div key={f.id} className="flex flex-wrap gap-2 items-end">
                <div className="min-w-[130px]">
                  <label className="text-[10px] text-gray-500 uppercase">Field</label>
                  <select
                    value={f.field}
                    onChange={(e) => {
                      const nextDef = allFilterFields.find((d) => d.field === e.target.value) || allFilterFields[0];
                      const nextOps = OPERATORS_BY_TYPE[nextDef.type];
                      const opValid = nextOps.some((o) => o.value === f.operator);
                      updateFilter(f.id, {
                        field: e.target.value,
                        value: '',
                        operator: opValid ? f.operator : nextOps[0].value,
                      });
                    }}
                    className={`${inputClass} w-full`}
                  >
                    {allFilterFields.map((d) => (
                      <option key={d.field} value={d.field}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[110px]">
                  <label className="text-[10px] text-gray-500 uppercase">Operator</label>
                  <select
                    value={effectiveOperator}
                    onChange={(e) => updateFilter(f.id, { operator: e.target.value as AdvancedFilter['operator'] })}
                    className={`${inputClass} w-full`}
                  >
                    {ops.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {needsValue && (
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] text-gray-500 uppercase">Value</label>
                    {def.type === 'select' && def.options ? (
                      <select
                        value={f.value}
                        onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                        className={`${inputClass} w-full`}
                      >
                        <option value="">Select…</option>
                        {def.options.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : def.type === 'reference' ? (
                      <select
                        value={f.value}
                        onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                        className={`${inputClass} w-full`}
                      >
                        <option value="">Select…</option>
                        {referenceOptions(f.field).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={def.type === 'date' ? 'date' : def.type === 'number' ? 'number' : 'text'}
                        value={f.value}
                        onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                        className={`${inputClass} w-full`}
                      />
                    )}
                  </div>
                )}
                <button type="button" onClick={() => removeFilter(f.id)} className={`${buttonClass} border-red-500/40 text-red-300 mb-0.5`}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showColumns && (
        <ColumnCustomizer columns={prefs.columns} onChange={reorderColumns} />
      )}

      {showViews && (
        <div className="rounded-lg border border-gray-700/50 bg-gray-900/30 p-3 space-y-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Saved views</p>
          {prefs.savedViews.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {prefs.savedViews.map((v) => (
                <span key={v.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-gray-700/60">
                  <button type="button" onClick={() => applyView(v)} className="text-blue-300 hover:text-blue-200">
                    {v.name}
                  </button>
                  <button type="button" onClick={() => deleteView(v.id)} className="text-red-400">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="View name"
              className={`${inputClass} flex-1`}
              onKeyDown={(e) => e.key === 'Enter' && saveCurrentView()}
            />
            <button type="button" onClick={saveCurrentView} disabled={!viewName.trim()} className={`${buttonClass} border-blue-500/40 text-blue-300 disabled:opacity-50`}>
              Save current
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
