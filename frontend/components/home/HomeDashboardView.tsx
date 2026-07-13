'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AUTO_REFRESH_OPTIONS, fetchHomeDashboardData } from '@/lib/homeDashboard';
import { HOME_DASHBOARD_TEMPLATES } from '@/lib/homeDashboardTemplates';
import type { HomeDataContext, HomeWidgetFilters } from '@/lib/homeDashboardWidgets';
import { useHomeDashboard } from '@/hooks/useHomeDashboard';
import HomeWidgetBoard from '@/components/home/HomeWidgetBoard';
import HomeInsightsPanel from '@/components/home/HomeInsightsPanel';
import { formatAssetStatusLabel } from '@/lib/assetStatuses';
import { canAccessFeature, fetchOrgSubscription, getStoredSubscription } from '@/lib/subscriptionUtils';
import { api } from '@/lib/homeDashboard';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';
const inputClass = 'px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

function getUserNameFromStorage(): string {
  if (typeof window === 'undefined') return '';
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return u.name || u.fullName || '';
  } catch {
    return '';
  }
}

export default function HomeDashboardView({
  groups,
  templates,
  departments,
  locations,
  vendors,
  users,
  statusOptions,
}: {
  groups: { _id: string; name: string }[];
  templates: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  vendors: { _id: string; name: string }[];
  users: { _id: string; name: string }[];
  statusOptions: string[];
}) {
  const [ctx, setCtx] = useState<HomeDataContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageFilters, setPageFilters] = useState<HomeWidgetFilters>({});
  const [configureMode, setConfigureMode] = useState(false);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [newDashName, setNewDashName] = useState('');
  const [newDashScope, setNewDashScope] = useState<'personal' | 'organization'>('personal');
  const [deleting, setDeleting] = useState(false);
  const [userName, setUserName] = useState('');
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);

  const hasInsightsAccess = canAccessFeature(tier, 'insights') && !isExpired;

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
  } = useHomeDashboard();

  useEffect(() => {
    setUserName(getUserNameFromStorage());
  }, []);

  useEffect(() => {
    fetchOrgSubscription(api).then((sub) => {
      setTier(sub.tier);
      setIsExpired(sub.isExpired);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHomeDashboardData(pageFilters);
      setCtx(data);
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

  const categories = useMemo(
    () => Array.from(new Set(ctx?.assets.map((a) => a.category).filter(Boolean) || [])),
    [ctx?.assets]
  );

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

  const setPageFilter = (key: keyof HomeWidgetFilters, value: string) => {
    setPageFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  if (!loaded) return <p className="text-sm text-gray-500 py-8 text-center">Loading dashboards…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">
          {getGreeting()}, {getFirstName(userName)}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Your customizable home dashboard</p>
      </div>

      {hasInsightsAccess ? <HomeInsightsPanel /> : null}

      <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3">
        <p className="text-[10px] text-gray-500 uppercase mb-2">Page filters</p>
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
            <label className="text-[9px] text-gray-600 block mb-0.5">From</label>
            <input type="date" className={inputClass} value={pageFilters.dateFrom || ''} onChange={(e) => setPageFilter('dateFrom', e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">To</label>
            <input type="date" className={inputClass} value={pageFilters.dateTo || ''} onChange={(e) => setPageFilter('dateTo', e.target.value)} />
          </div>
          <button type="button" onClick={load} className={`${buttonClass} border-blue-500/40 text-blue-300`}>Apply</button>
        </div>
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
            <input className={inputClass} value={newDashName} onChange={(e) => setNewDashName(e.target.value)} placeholder="Operations" />
          </div>
          <select className={inputClass} value={newDashScope} onChange={(e) => setNewDashScope(e.target.value as 'personal' | 'organization')}>
            <option value="personal">Personal</option>
            <option value="organization">Organization</option>
          </select>
          <button type="button" onClick={async () => { if (!newDashName.trim()) return; await createDashboard({ name: newDashName.trim(), scope: newDashScope, autoRefresh: 'manual', theme: 'comfortable' }); setNewDashName(''); setShowNewDashboard(false); }} className={`${buttonClass} border-emerald-500/40 text-emerald-300`}>Create</button>
        </div>
      )}

      <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3">
        <p className="text-[10px] text-gray-500 uppercase mb-2">Dashboard templates</p>
        <div className="flex flex-wrap gap-2">
          {HOME_DASHBOARD_TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => applyDashboardTemplate(t.id)} className={`${buttonClass} border-violet-500/30 text-violet-300`} title={t.description}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {loading || !ctx ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading dashboard data…</p>
      ) : (
        <HomeWidgetBoard
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
        />
      )}
    </div>
  );
}
