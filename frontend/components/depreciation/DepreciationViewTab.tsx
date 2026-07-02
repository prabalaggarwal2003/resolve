'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  authHeaders,
  filtersToQuery,
  formatCurrency,
  POLICY_SOURCE_LABELS,
  type AssetDepreciationMetrics,
  type DepreciationFilters,
  type DepreciationPolicy,
} from '@/lib/depreciation';
import DepreciationWidgetBoard from '@/components/depreciation/DepreciationWidgetBoard';
import { useDepreciationDashboardLayout } from '@/hooks/useDepreciationDashboardLayout';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';
const inputClass =
  'px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 w-full';

function healthColor(score: number) {
  if (score >= 90) return 'text-green-400';
  if (score >= 75) return 'text-blue-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function IndicatorBadges({ a }: { a: AssetDepreciationMetrics }) {
  const badges = [];
  if (a.indicators?.fullyDepreciated) badges.push({ label: 'Fully depreciated', cls: 'border-gray-500/40 text-gray-400' });
  if (a.indicators?.nearEndOfLife) badges.push({ label: 'Near end of life', cls: 'border-amber-500/40 text-amber-300' });
  if (a.indicators?.replacementRecommended) badges.push({ label: 'Replacement recommended', cls: 'border-orange-500/40 text-orange-300' });
  if (a.indicators?.highValueAsset) badges.push({ label: 'High value', cls: 'border-violet-500/40 text-violet-300' });
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map((b) => (
        <span key={b.label} className={`px-1.5 py-0.5 text-[9px] rounded border ${b.cls}`}>{b.label}</span>
      ))}
    </div>
  );
}

export default function DepreciationViewTab({
  policies,
  groups,
  templates,
  departments,
  locations,
  vendors,
  statusOptions,
}: {
  policies: DepreciationPolicy[];
  groups: { _id: string; name: string }[];
  templates: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  vendors: { _id: string; name: string }[];
  statusOptions: string[];
}) {
  const [assets, setAssets] = useState<AssetDepreciationMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DepreciationFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showAssetTable, setShowAssetTable] = useState(false);
  const [configureMode, setConfigureMode] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const { layout, updateLayout, loaded: layoutLoaded, saving, saveNow } = useDepreciationDashboardLayout();

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(api(`/api/depreciation/summary${filtersToQuery(filters)}`), {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) setAssets(data.assets || []);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = Array.from(new Set(assets.map((a) => a.category).filter(Boolean)));
  const paginated = assets.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(assets.length / PER_PAGE);
  const activeFilterCount = Object.values(filters).filter((v) => v != null && v !== '').length;

  if (!layoutLoaded) {
    return <p className="text-sm text-gray-500 py-8 text-center">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className={`${buttonClass} border-violet-500/40 ${showFilters ? 'bg-violet-500/15 text-violet-300' : 'text-gray-400'}`}
        >
          Page filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        <button type="button" onClick={() => { setFilters({}); setPage(1); }} className={`${buttonClass} border-gray-700/60 text-gray-400`}>
          Clear filters
        </button>
        <button type="button" onClick={load} className={`${buttonClass} border-blue-500/40 text-blue-300`}>
          Refresh data
        </button>
        <button
          type="button"
          onClick={() => setConfigureMode((s) => !s)}
          className={`${buttonClass} ${configureMode ? 'bg-violet-500/20 text-violet-200 border-violet-500/40' : 'border-gray-700/60 text-gray-400'}`}
        >
          {configureMode ? 'Done configuring' : 'Configure widgets'}
        </button>
        {configureMode && (
          <button type="button" onClick={saveNow} className={`${buttonClass} border-emerald-500/40 text-emerald-300`}>
            Save layout{saving ? '…' : ''}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowAssetTable((s) => !s)}
          className={`${buttonClass} ${showAssetTable ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-gray-700/60 text-gray-400'}`}
        >
          {showAssetTable ? 'Hide asset table' : 'Show asset table'}
        </button>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <FilterSelect label="Method" value={filters.method || ''} onChange={(v) => setFilters((f) => ({ ...f, method: v }))} options={[{ v: 'SLM', l: 'SLM' }, { v: 'WDV', l: 'WDV' }]} />
          <FilterSelect label="Policy" value={filters.policyId || ''} onChange={(v) => setFilters((f) => ({ ...f, policyId: v }))} options={policies.map((p) => ({ v: p._id, l: p.name }))} />
          <FilterSelect label="Asset group" value={filters.groupId || ''} onChange={(v) => setFilters((f) => ({ ...f, groupId: v }))} options={groups.map((g) => ({ v: g._id, l: g.name }))} />
          <FilterSelect label="Template" value={filters.templateId || ''} onChange={(v) => setFilters((f) => ({ ...f, templateId: v }))} options={templates.map((t) => ({ v: t._id, l: t.name }))} />
          <FilterSelect label="Category" value={filters.category || ''} onChange={(v) => setFilters((f) => ({ ...f, category: v }))} options={categories.map((c) => ({ v: c, l: c }))} />
          <FilterInput label="Purchase year" value={filters.purchaseYear || ''} onChange={(v) => setFilters((f) => ({ ...f, purchaseYear: v }))} type="number" />
          <FilterInput label="Purchase min" value={filters.purchaseMin || ''} onChange={(v) => setFilters((f) => ({ ...f, purchaseMin: v }))} type="number" />
          <FilterInput label="Purchase max" value={filters.purchaseMax || ''} onChange={(v) => setFilters((f) => ({ ...f, purchaseMax: v }))} type="number" />
          <FilterInput label="Book value min" value={filters.bookMin || ''} onChange={(v) => setFilters((f) => ({ ...f, bookMin: v }))} type="number" />
          <FilterInput label="Book value max" value={filters.bookMax || ''} onChange={(v) => setFilters((f) => ({ ...f, bookMax: v }))} type="number" />
          <FilterInput label="Dep % min" value={filters.depPctMin || ''} onChange={(v) => setFilters((f) => ({ ...f, depPctMin: v }))} type="number" />
          <FilterInput label="Dep % max" value={filters.depPctMax || ''} onChange={(v) => setFilters((f) => ({ ...f, depPctMax: v }))} type="number" />
          <FilterInput label="Health min" value={filters.healthMin || ''} onChange={(v) => setFilters((f) => ({ ...f, healthMin: v }))} type="number" />
          <FilterSelect label="Warranty" value={filters.warrantyStatus || ''} onChange={(v) => setFilters((f) => ({ ...f, warrantyStatus: v }))} options={[{ v: 'active', l: 'Active' }, { v: 'expiring', l: 'Expiring' }, { v: 'expired', l: 'Expired' }]} />
          <FilterSelect label="Replacement" value={filters.replacementPriority || ''} onChange={(v) => setFilters((f) => ({ ...f, replacementPriority: v }))} options={[{ v: 'low', l: 'Low' }, { v: 'medium', l: 'Medium' }, { v: 'high', l: 'High' }, { v: 'critical', l: 'Critical' }]} />
          <FilterSelect label="Fully depreciated" value={filters.fullyDepreciated || ''} onChange={(v) => setFilters((f) => ({ ...f, fullyDepreciated: v }))} options={[{ v: 'true', l: 'Yes' }]} />
          <FilterSelect label="Department" value={filters.departmentId || ''} onChange={(v) => setFilters((f) => ({ ...f, departmentId: v }))} options={departments.map((d) => ({ v: d._id, l: d.name }))} />
          <FilterSelect label="Location" value={filters.locationId || ''} onChange={(v) => setFilters((f) => ({ ...f, locationId: v }))} options={locations.map((l) => ({ v: l._id, l: l.name }))} />
          <FilterSelect label="Vendor" value={filters.vendorId || ''} onChange={(v) => setFilters((f) => ({ ...f, vendorId: v }))} options={vendors.map((v) => ({ v: v._id, l: v.name }))} />
        </div>
      )}

      {activeFilterCount > 0 && (
        <p className="text-[11px] text-violet-400/80">
          Page filters active — {assets.length} asset{assets.length !== 1 ? 's' : ''} · all widgets use this filtered dataset plus their own filters.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading depreciation data…</p>
      ) : (
        <>
          <DepreciationWidgetBoard
            assets={assets}
            layout={layout}
            onLayoutChange={updateLayout}
            configureMode={configureMode}
            groups={groups}
            templates={templates}
            departments={departments}
            locations={locations}
            vendors={vendors}
            policies={policies}
            categories={categories}
            saving={saving}
            statusOptions={statusOptions}
          />

          {showAssetTable && (
            <div className="rounded-xl border border-gray-700/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-700/50 bg-gray-900/40">
                <p className="text-xs font-semibold text-gray-300">Asset-level metrics</p>
                <p className="text-[11px] text-gray-500">{assets.length} assets</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900/80 border-b border-gray-700/60">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">Asset</th>
                      <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">Policy</th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase text-gray-500">Cost</th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase text-gray-500">Book value</th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase text-gray-500">Dep %</th>
                      <th className="px-3 py-2 text-center text-[10px] uppercase text-gray-500">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/40">
                    {paginated.map((a) => (
                      <tr key={a.assetId} className="hover:bg-gray-800/40 align-top">
                        <td className="px-3 py-2">
                          <Link href={`/dashboard/assets/${a.assetId}`} className="font-medium text-gray-200 hover:text-blue-300 no-underline">
                            {a.name}
                          </Link>
                          <p className="text-[10px] text-gray-500">{a.assetIdString} · {a.category}</p>
                          <IndicatorBadges a={a} />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-400">
                          {a.policy ? (
                            <>
                              <p className="text-gray-200">{a.policy.name}</p>
                              <p className="text-[10px] text-gray-600">{POLICY_SOURCE_LABELS[a.policy.source] || a.policy.source}</p>
                            </>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-300">{a.financial.purchaseCost > 0 ? formatCurrency(a.financial.purchaseCost) : '—'}</td>
                        <td className="px-3 py-2 text-right text-blue-300">{formatCurrency(a.financial.currentBookValue)}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{a.financial.depreciationPercentage}%</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-semibold ${healthColor(a.operational.healthScore)}`}>{a.operational.healthScore}%</span>
                        </td>
                      </tr>
                    ))}
                    {!paginated.length && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">No assets match filters</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex justify-between items-center px-3 py-2 border-t border-gray-700/40 text-xs text-gray-500">
                  <span>Page {page} of {totalPages}</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={`${buttonClass} disabled:opacity-40`}>Prev</button>
                    <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className={`${buttonClass} disabled:opacity-40`}>Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase block mb-0.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">All</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function FilterInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase block mb-0.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}
