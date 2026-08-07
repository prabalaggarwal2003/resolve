'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AUTO_REFRESH_OPTIONS, fetchKpiSummary } from '@/lib/kpi';
import { KPI_DASHBOARD_TEMPLATES } from '@/lib/kpiDashboardTemplates';
import type { KpiDataContext, KpiFilterFieldKey, KpiWidgetFilters } from '@/lib/kpiWidgets';
import { useKpiDashboard } from '@/hooks/useKpiDashboard';
import KpiWidgetBoard from '@/components/kpis/KpiWidgetBoard';
import { formatAssetStatusLabel } from '@/lib/assetStatuses';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';
const inputClass = 'px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 min-w-[120px]';

export default function KpiViewTab({
  groups,
  templates,
  departments,
  locations,
  vendors,
  users,
  statusOptions,
  partnerStatuses = [],
  partnerTypes = [],
  partnerCategories = [],
}: {
  groups: { _id: string; name: string }[];
  templates: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  vendors: { _id: string; name: string }[];
  users: { _id: string; name: string }[];
  statusOptions: string[];
  partnerStatuses?: { id: string; name: string }[];
  partnerTypes?: { id: string; name: string }[];
  partnerCategories?: { id: string; name: string }[];
}) {
  const [ctx, setCtx] = useState<KpiDataContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageFilters, setPageFilters] = useState<KpiWidgetFilters>({});
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [configureMode, setConfigureMode] = useState(false);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [newDashName, setNewDashName] = useState('');
  const [newDashScope, setNewDashScope] = useState<'personal' | 'organization'>('personal');
  const [deleting, setDeleting] = useState(false);

  const {
    dashboards,
    activeDashboard,
    layout,
    loaded,
    saving,
    updateLayout,
    switchDashboard,
    createDashboard,
    duplicateDashboard,
    applyDashboardTemplate,
    deleteDashboard,
    setAutoRefresh,
    setDashboardScope,
    saveNow,
  } = useKpiDashboard();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKpiSummary(pageFilters);
      setCtx({
        assets: data.assets,
        totals: data.totals,
        quick: data.quick,
        budget: data.budget ?? null,
        partners: data.partners
          ? {
              partners: data.partners.partners || [],
              contracts: data.partners.contracts || [],
              recentActivity: data.partners.recentActivity || [],
              topPartners: data.partners.topPartners || [],
              expiryWindowDays: data.partners.expiryWindowDays,
            }
          : null,
      });
    } finally {
      setLoading(false);
    }
  }, [pageFilters]);

  useEffect(() => { load(); }, [load]);

  const refreshMs = useMemo(() => {
    const id = activeDashboard?.autoRefresh || 'manual';
    return AUTO_REFRESH_OPTIONS.find((o) => o.id === id)?.ms ?? 0;
  }, [activeDashboard?.autoRefresh]);

  useEffect(() => {
    if (!refreshMs) return;
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [refreshMs, load]);

  const categories = useMemo(() => Array.from(new Set(ctx?.assets.map((a) => a.category).filter(Boolean) || [])), [ctx?.assets]);

  const activePageFilterCount = useMemo(
    () => Object.values(pageFilters).filter((v) => v != null && v !== '').length,
    [pageFilters]
  );

  const setPageFilter = (key: KpiFilterFieldKey, value: string) => {
    setPageFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const clearPageFilters = () => setPageFilters({});

  const sharedDashboards = useMemo(
    () => dashboards.filter((d) => d.scope === 'organization'),
    [dashboards]
  );
  const templateDashboards = useMemo(
    () => dashboards.filter((d) => d.scope === 'personal' && d.templateId),
    [dashboards]
  );
  const myDashboards = useMemo(
    () => dashboards.filter((d) => d.scope === 'personal' && !d.templateId),
    [dashboards]
  );

  const applyTemplate = async (templateId: string) => {
    await applyDashboardTemplate(templateId);
  };

  const handleDeleteDashboard = async () => {
    if (!activeDashboard || deleting) return;
    const label = `"${activeDashboard.name}"`;
    if (!confirm(`Delete dashboard ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDashboard(activeDashboard._id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete dashboard');
    } finally {
      setDeleting(false);
    }
  };

  if (!loaded) return <p className="text-sm text-gray-500 py-8 text-center">Loading dashboards…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className="text-[10px] text-gray-500 uppercase">Page filters</p>
          <div className="flex items-center gap-2">
            {activePageFilterCount > 0 && (
              <span className="text-[11px] text-violet-400/80">
                {activePageFilterCount} active · applied to all widgets
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowMoreFilters((s) => !s)}
              className={`${buttonClass} border-gray-700/60 text-gray-400`}
            >
              {showMoreFilters ? 'Fewer filters' : 'More filters'}
            </button>
            <button
              type="button"
              onClick={clearPageFilters}
              disabled={activePageFilterCount === 0}
              className={`${buttonClass} border-gray-700/60 text-gray-400 disabled:opacity-40`}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">Department</label>
            <select className={inputClass} value={pageFilters.departmentId || ''} onChange={(e) => setPageFilter('departmentId', e.target.value)}>
              <option value="">All</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">Location</label>
            <select className={inputClass} value={pageFilters.locationId || ''} onChange={(e) => setPageFilter('locationId', e.target.value)}>
              <option value="">All</option>
              {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">Group</label>
            <select className={inputClass} value={pageFilters.groupId || ''} onChange={(e) => setPageFilter('groupId', e.target.value)}>
              <option value="">All</option>
              {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">Status</label>
            <select className={inputClass} value={pageFilters.status || ''} onChange={(e) => setPageFilter('status', e.target.value)}>
              <option value="">All</option>
              {statusOptions.map((s) => <option key={s} value={s}>{formatAssetStatusLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">Vendor / Partner</label>
            <select className={inputClass} value={pageFilters.vendorId || ''} onChange={(e) => setPageFilter('vendorId', e.target.value)}>
              <option value="">All</option>
              {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">From</label>
            <input type="date" className={inputClass} value={pageFilters.dateFrom || ''} onChange={(e) => setPageFilter('dateFrom', e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">To</label>
            <input type="date" className={inputClass} value={pageFilters.dateTo || ''} onChange={(e) => setPageFilter('dateTo', e.target.value)} />
          </div>
        </div>
        {showMoreFilters && (
          <div className="flex flex-wrap gap-2 items-end mt-2 pt-2 border-t border-gray-800/80">
            <div>
              <label className="text-[9px] text-gray-600 block mb-0.5">Template</label>
              <select className={inputClass} value={pageFilters.templateId || ''} onChange={(e) => setPageFilter('templateId', e.target.value)}>
                <option value="">All</option>
                {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-600 block mb-0.5">Category</label>
              <select className={inputClass} value={pageFilters.category || ''} onChange={(e) => setPageFilter('category', e.target.value)}>
                <option value="">All</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-600 block mb-0.5">Warranty</label>
              <select className={inputClass} value={pageFilters.warrantyStatus || ''} onChange={(e) => setPageFilter('warrantyStatus', e.target.value)}>
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="expiring">Expiring</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-600 block mb-0.5">Condition</label>
              <select className={inputClass} value={pageFilters.condition || ''} onChange={(e) => setPageFilter('condition', e.target.value)}>
                <option value="">All</option>
                {['excellent', 'good', 'fair', 'poor', 'critical', 'under_maintenance'].map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-600 block mb-0.5">Assigned user</label>
              <select className={inputClass} value={pageFilters.assignedUserId || ''} onChange={(e) => setPageFilter('assignedUserId', e.target.value)}>
                <option value="">All</option>
                {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-600 block mb-0.5">Purchase year</label>
              <input type="number" className={inputClass} placeholder="Year" value={pageFilters.purchaseYear || ''} onChange={(e) => setPageFilter('purchaseYear', e.target.value)} />
            </div>
            <div>
              <label className="text-[9px] text-gray-600 block mb-0.5">Partner status</label>
              <select className={inputClass} value={pageFilters.partnerStatus || ''} onChange={(e) => setPageFilter('partnerStatus', e.target.value)}>
                <option value="">All</option>
                {partnerStatuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-600 block mb-0.5">Partner type</label>
              <select className={inputClass} value={pageFilters.partnerTypeKey || ''} onChange={(e) => setPageFilter('partnerTypeKey', e.target.value)}>
                <option value="">All</option>
                {partnerTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-600 block mb-0.5">Partner category</label>
              <select className={inputClass} value={pageFilters.partnerCategoryKey || ''} onChange={(e) => setPageFilter('partnerCategoryKey', e.target.value)}>
                <option value="">All</option>
                {partnerCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-600 block mb-0.5">Partner search</label>
              <input
                className={inputClass}
                placeholder="Name / code"
                value={pageFilters.partnerSearch || ''}
                onChange={(e) => setPageFilter('partnerSearch', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          className={inputClass}
          value={activeDashboard?._id || ''}
          onChange={(e) => switchDashboard(e.target.value)}
        >
          {sharedDashboards.length > 0 && (
            <optgroup label="Shared dashboards">
              {sharedDashboards.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </optgroup>
          )}
          {templateDashboards.length > 0 && (
            <optgroup label="Templates">
              {templateDashboards.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </optgroup>
          )}
          {myDashboards.length > 0 && (
            <optgroup label="My dashboards">
              {myDashboards.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </optgroup>
          )}
        </select>
        <button type="button" onClick={() => setShowNewDashboard((s) => !s)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>+ New dashboard</button>
        <button type="button" onClick={() => activeDashboard && duplicateDashboard(activeDashboard._id)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Duplicate</button>
        <button
          type="button"
          onClick={handleDeleteDashboard}
          disabled={!activeDashboard || deleting}
          className={`${buttonClass} border-red-500/30 text-red-400 disabled:opacity-40`}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
        <select
          className={inputClass}
          value={activeDashboard?.autoRefresh || 'manual'}
          onChange={(e) => setAutoRefresh(e.target.value as 'manual' | '1m' | '5m' | '15m')}
        >
          {AUTO_REFRESH_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select className={inputClass} value={activeDashboard?.scope || 'personal'} onChange={(e) => setDashboardScope(e.target.value as 'personal' | 'organization')}>
          <option value="personal">Personal dashboard</option>
          <option value="organization">Shared (organization)</option>
        </select>
        <button type="button" onClick={load} className={`${buttonClass} border-blue-500/40 text-blue-300`}>Refresh</button>
        <button type="button" onClick={() => setConfigureMode((s) => !s)} className={`${buttonClass} ${configureMode ? 'bg-violet-500/20 text-violet-200 border-violet-500/40' : 'border-gray-700/60 text-gray-400'}`}>
          {configureMode ? 'Done configuring' : 'Configure widgets'}
        </button>
        {configureMode && <button type="button" onClick={saveNow} className={`${buttonClass} border-emerald-500/40 text-emerald-300`}>Save{saving ? '…' : ''}</button>}
      </div>

      {showNewDashboard && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3 flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Dashboard name</label>
            <input className={inputClass} value={newDashName} onChange={(e) => setNewDashName(e.target.value)} placeholder="Finance" />
          </div>
          <select className={inputClass} value={newDashScope} onChange={(e) => setNewDashScope(e.target.value as 'personal' | 'organization')}>
            <option value="personal">Personal</option>
            <option value="organization">Organization</option>
          </select>
          <button type="button" onClick={async () => { if (!newDashName.trim()) return; await createDashboard({ name: newDashName.trim(), scope: newDashScope, autoRefresh: 'manual' }); setNewDashName(''); setShowNewDashboard(false); }} className={`${buttonClass} border-emerald-500/40 text-emerald-300`}>Create</button>
        </div>
      )}

      <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3">
        <p className="text-[10px] text-gray-500 uppercase mb-2">Dashboard templates</p>
        <div className="flex flex-wrap gap-2">
          {KPI_DASHBOARD_TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => applyTemplate(t.id)} className={`${buttonClass} border-violet-500/30 text-violet-300`} title={t.description}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {loading || !ctx ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading KPI data…</p>
      ) : (
        <KpiWidgetBoard
          ctx={ctx}
          layout={layout}
          onLayoutChange={updateLayout}
          configureMode={configureMode}
          groups={groups}
          templates={templates}
          departments={departments}
          locations={locations}
          vendors={vendors}
          categories={categories}
          users={users}
          saving={saving}
          statusOptions={statusOptions}
          partnerStatuses={partnerStatuses}
          partnerTypes={partnerTypes}
          partnerCategories={partnerCategories}
        />
      )}
    </div>
  );
}
