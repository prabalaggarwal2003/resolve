'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AUTO_REFRESH_OPTIONS, fetchHealthData, runHealthCheckAll } from '@/lib/assetHealth';
import type { HealthDataContext, HealthWidgetFilters } from '@/lib/assetHealthWidgets';
import { useAssetHealthDashboard } from '@/hooks/useAssetHealthDashboard';
import AssetHealthWidgetBoard from './AssetHealthWidgetBoard';

const inputClass = 'px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

export default function AssetHealthViewTab({
  groups,
  departments,
  locations,
  categories,
  statusOptions,
}: {
  groups: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  categories: string[];
  statusOptions: string[];
}) {
  const [ctx, setCtx] = useState<HealthDataContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageFilters, setPageFilters] = useState<HealthWidgetFilters>({});
  const [configureMode, setConfigureMode] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);
  const [message, setMessage] = useState('');
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
    deleteDashboard,
    setAutoRefresh,
    setDashboardScope,
    saveNow,
  } = useAssetHealthDashboard();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHealthData(pageFilters);
      setCtx({ assets: data.assets, totals: data.totals, trend: data.trend || [] });
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

  const handleRunCheck = async () => {
    setRunningCheck(true);
    setMessage('');
    try {
      const res = await runHealthCheckAll();
      setMessage(`Updated ${res.updated} assets · ${res.maintenance} in maintenance · ${res.critical} critical`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setRunningCheck(false);
    }
  };

  const handleDeleteDashboard = async () => {
    if (!activeDashboard || deleting) return;
    if (!confirm(`Delete dashboard "${activeDashboard.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDashboard(activeDashboard._id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to delete dashboard');
    } finally {
      setDeleting(false);
    }
  };

  const sharedDashboards = useMemo(() => dashboards.filter((d) => d.scope === 'organization'), [dashboards]);
  const myDashboards = useMemo(() => dashboards.filter((d) => d.scope === 'personal'), [dashboards]);

  if (!loaded) return <p className="text-sm text-gray-500 py-8 text-center">Loading dashboards…</p>;

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-2 items-center">
        <select className={inputClass} value={activeDashboard?._id || ''} onChange={(e) => switchDashboard(e.target.value)}>
          {sharedDashboards.length > 0 && (
            <optgroup label="Shared dashboards">
              {sharedDashboards.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </optgroup>
          )}
          {myDashboards.length > 0 && (
            <optgroup label="My dashboards">
              {myDashboards.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </optgroup>
          )}
        </select>
        <button type="button" onClick={() => setShowNewDashboard((s) => !s)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>+ New dashboard</button>
        <button type="button" onClick={() => activeDashboard && duplicateDashboard(activeDashboard._id)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Duplicate</button>
        <button type="button" onClick={handleDeleteDashboard} disabled={!activeDashboard || deleting} className={`${buttonClass} border-red-500/30 text-red-400 disabled:opacity-40`}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
        <select className={inputClass} value={activeDashboard?.autoRefresh || 'manual'} onChange={(e) => setAutoRefresh(e.target.value)}>
          {AUTO_REFRESH_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select className={inputClass} value={activeDashboard?.scope || 'personal'} onChange={(e) => setDashboardScope(e.target.value as 'personal' | 'organization')}>
          <option value="personal">Personal dashboard</option>
          <option value="organization">Shared (organization)</option>
        </select>
        <select className={inputClass} value={pageFilters.groupId || ''} onChange={(e) => setPageFilters((f) => ({ ...f, groupId: e.target.value || undefined }))}>
          <option value="">All groups</option>
          {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
        </select>
        <select className={inputClass} value={pageFilters.departmentId || ''} onChange={(e) => setPageFilters((f) => ({ ...f, departmentId: e.target.value || undefined }))}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <select className={inputClass} value={pageFilters.locationId || ''} onChange={(e) => setPageFilters((f) => ({ ...f, locationId: e.target.value || undefined }))}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
        </select>
        <button type="button" onClick={load} className={`${buttonClass} border-blue-500/40 text-blue-300`}>Refresh</button>
        <button
          type="button"
          onClick={() => setConfigureMode((s) => !s)}
          className={`${buttonClass} ${configureMode ? 'bg-violet-500/20 text-violet-200 border-violet-500/40' : 'border-gray-700/60 text-gray-400'}`}
        >
          {configureMode ? 'Done configuring' : 'Configure widgets'}
        </button>
        {configureMode && (
          <button type="button" onClick={saveNow} className={`${buttonClass} border-emerald-500/40 text-emerald-300`}>
            Save{saving ? '…' : ''}
          </button>
        )}
        <button type="button" onClick={handleRunCheck} disabled={runningCheck} className={`${buttonClass} border-gray-600 text-gray-200 hover:bg-gray-800 disabled:opacity-50`}>
          {runningCheck ? 'Running…' : 'Run health check'}
        </button>
      </div>

      {showNewDashboard && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3 flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Dashboard name</label>
            <input className={inputClass} value={newDashName} onChange={(e) => setNewDashName(e.target.value)} placeholder="Operations health" />
          </div>
          <select className={inputClass} value={newDashScope} onChange={(e) => setNewDashScope(e.target.value as 'personal' | 'organization')}>
            <option value="personal">Personal</option>
            <option value="organization">Organization</option>
          </select>
          <button
            type="button"
            onClick={async () => {
              if (!newDashName.trim()) return;
              await createDashboard({ name: newDashName.trim(), scope: newDashScope });
              setNewDashName('');
              setShowNewDashboard(false);
            }}
            className={`${buttonClass} border-emerald-500/40 text-emerald-300`}
          >
            Create
          </button>
        </div>
      )}

      {message && <p className="text-xs text-gray-400">{message}</p>}

      {loading || !ctx ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading health data…</p>
      ) : (
        <AssetHealthWidgetBoard
          ctx={ctx}
          layout={layout}
          onLayoutChange={updateLayout}
          configureMode={configureMode}
          groups={groups}
          departments={departments}
          locations={locations}
          categories={categories}
          statusOptions={statusOptions}
          saving={saving}
        />
      )}
    </div>
  );
}
