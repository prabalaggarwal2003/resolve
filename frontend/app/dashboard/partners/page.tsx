'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PartnerWidgetBoard from '@/components/partners/PartnerWidgetBoard';
import { usePartnerDashboard } from '@/hooks/usePartnerDashboard';
import { fetchPartnerConfig, fetchPartnerSummary } from '@/lib/businessPartners';
import {
  PARTNER_AUTO_REFRESH_OPTIONS,
  type PartnerDataContext,
  type PartnerFilterFieldKey,
  type PartnerWidgetFilters,
} from '@/lib/partnerDashboardWidgets';
import { canWrite } from '@/lib/permissions';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';
const inputClass =
  'px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 min-w-[120px]';

export default function PartnersDashboardPage() {
  const canEdit = canWrite('businessPartners');
  const [ctx, setCtx] = useState<PartnerDataContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageFilters, setPageFilters] = useState<PartnerWidgetFilters>({});
  const [configureMode, setConfigureMode] = useState(false);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [newDashName, setNewDashName] = useState('');
  const [newDashScope, setNewDashScope] = useState<'personal' | 'organization'>('personal');
  const [deleting, setDeleting] = useState(false);
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);
  const [partnerTypes, setPartnerTypes] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

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
  } = usePartnerDashboard();

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPartnerSummary(pageFilters as Record<string, string>);
      setCtx({
        partners: data.partners || [],
        contracts: data.contracts || [],
        recentActivity: data.recentActivity || [],
        topPartners: data.topPartners || [],
        expiryWindowDays: data.expiryWindowDays,
      });
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [pageFilters]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    fetchPartnerConfig()
      .then((cfg) => {
        setStatuses(cfg.statuses || []);
        setPartnerTypes(cfg.partnerTypes || []);
        setCategories(cfg.categories || []);
      })
      .catch(() => null);
  }, []);

  const refreshMs = useMemo(() => {
    const id = activeDashboard?.autoRefresh || 'manual';
    return PARTNER_AUTO_REFRESH_OPTIONS.find((o) => o.id === id)?.ms ?? 0;
  }, [activeDashboard?.autoRefresh]);

  useEffect(() => {
    if (!refreshMs) return;
    const t = setInterval(loadSummary, refreshMs);
    return () => clearInterval(t);
  }, [refreshMs, loadSummary]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const p of ctx?.partners || []) {
      for (const tag of p.tags || []) if (tag) set.add(tag);
    }
    return Array.from(set).sort();
  }, [ctx?.partners]);

  const activePageFilterCount = useMemo(
    () => Object.values(pageFilters).filter((v) => v != null && v !== '').length,
    [pageFilters]
  );

  const setPageFilter = (key: PartnerFilterFieldKey, value: string) => {
    setPageFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const sharedDashboards = useMemo(
    () => dashboards.filter((d) => d.scope === 'organization'),
    [dashboards]
  );
  const myDashboards = useMemo(
    () => dashboards.filter((d) => d.scope === 'personal'),
    [dashboards]
  );

  const handleDeleteDashboard = async () => {
    if (!activeDashboard || deleting) return;
    if (!confirm(`Delete dashboard "${activeDashboard.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDashboard(activeDashboard._id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete dashboard');
    } finally {
      setDeleting(false);
    }
  };

  if (!loaded) return <LoadingSpinner message="Loading dashboards..." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Partners Dashboard</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Customizable KPIs, page filters, and per-widget filters
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={inputClass}
            value={activeDashboard?._id || ''}
            onChange={(e) => switchDashboard(e.target.value)}
          >
            {myDashboards.length > 0 && (
              <optgroup label="My dashboards">
                {myDashboards.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            )}
            {sharedDashboards.length > 0 && (
              <optgroup label="Organization">
                {sharedDashboards.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <select
            className={inputClass}
            value={activeDashboard?.autoRefresh || 'manual'}
            onChange={(e) => setAutoRefresh(e.target.value as any)}
          >
            {PARTNER_AUTO_REFRESH_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                Refresh: {o.label}
              </option>
            ))}
          </select>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setConfigureMode((v) => !v)}
                className={`${buttonClass} ${
                  configureMode
                    ? 'border-violet-500/50 text-violet-300 bg-violet-500/10'
                    : 'border-gray-700/60 text-gray-400'
                }`}
              >
                {configureMode ? 'Done' : 'Configure'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewDashboard(true)}
                className={`${buttonClass} border-emerald-500/40 text-emerald-300`}
              >
                New
              </button>
              {activeDashboard && (
                <button
                  type="button"
                  onClick={() => duplicateDashboard(activeDashboard._id)}
                  className={`${buttonClass} border-gray-700/60 text-gray-400`}
                >
                  Duplicate
                </button>
              )}
              {activeDashboard && (
                <button
                  type="button"
                  onClick={handleDeleteDashboard}
                  disabled={deleting}
                  className={`${buttonClass} border-red-500/30 text-red-400 disabled:opacity-50`}
                >
                  Delete
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={loadSummary}
            className={`${buttonClass} border-gray-700/60 text-gray-400`}
          >
            Refresh
          </button>
        </div>
      </div>

      {configureMode && activeDashboard && canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-700/50 bg-gray-900/30 p-2.5">
          <span className="text-[10px] text-gray-500 uppercase">Dashboard</span>
          <select
            className={inputClass}
            value={activeDashboard.scope}
            onChange={(e) => setDashboardScope(e.target.value as 'personal' | 'organization')}
          >
            <option value="personal">Personal</option>
            <option value="organization">Organization</option>
          </select>
          {saving && <span className="text-[10px] text-gray-500">Saving layout…</span>}
        </div>
      )}

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
              onClick={() => setPageFilters({})}
              disabled={activePageFilterCount === 0}
              className={`${buttonClass} border-gray-700/60 text-gray-400 disabled:opacity-40`}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">Status</label>
            <select
              className={inputClass}
              value={pageFilters.status || ''}
              onChange={(e) => setPageFilter('status', e.target.value)}
            >
              <option value="">All</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">Partner type</label>
            <select
              className={inputClass}
              value={pageFilters.partnerTypeKey || ''}
              onChange={(e) => setPageFilter('partnerTypeKey', e.target.value)}
            >
              <option value="">All</option>
              {partnerTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">Category</label>
            <select
              className={inputClass}
              value={pageFilters.categoryKey || ''}
              onChange={(e) => setPageFilter('categoryKey', e.target.value)}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">Tag</label>
            <select
              className={inputClass}
              value={pageFilters.tag || ''}
              onChange={(e) => setPageFilter('tag', e.target.value)}
            >
              <option value="">All</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 block mb-0.5">Search</label>
            <input
              className={inputClass}
              value={pageFilters.search || ''}
              onChange={(e) => setPageFilter('search', e.target.value)}
              placeholder="Name / code"
            />
          </div>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {loading && !ctx ? (
        <LoadingSpinner message="Loading partner metrics..." />
      ) : ctx ? (
        <PartnerWidgetBoard
          ctx={ctx}
          layout={layout}
          onLayoutChange={updateLayout}
          configureMode={configureMode && canEdit}
          statuses={statuses}
          partnerTypes={partnerTypes}
          categories={categories}
          tags={tags}
          saving={saving}
        />
      ) : null}

      {showNewDashboard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setShowNewDashboard(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-700/60 bg-gray-900 p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-100">New dashboard</h3>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Name</label>
              <input
                className="w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                value={newDashName}
                onChange={(e) => setNewDashName(e.target.value)}
                placeholder="e.g. Supplier risk"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Scope</label>
              <select
                className="w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                value={newDashScope}
                onChange={(e) => setNewDashScope(e.target.value as 'personal' | 'organization')}
              >
                <option value="personal">Personal</option>
                <option value="organization">Organization</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewDashboard(false)}
                className={`${buttonClass} border-gray-700/60 text-gray-400`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newDashName.trim()) return;
                  await createDashboard({ name: newDashName.trim(), scope: newDashScope });
                  setNewDashName('');
                  setShowNewDashboard(false);
                  setConfigureMode(true);
                }}
                className={`${buttonClass} border-emerald-500/40 text-emerald-300`}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
