'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AUTO_REFRESH_OPTIONS, fetchBudgetAnalytics } from '@/lib/budgetDashboard';
import { BUDGET_DASHBOARD_TEMPLATES } from '@/lib/budgetDashboardTemplates';
import type { BudgetDataContext } from '@/lib/budgetWidgets';
import { useBudgetDashboard } from '@/hooks/useBudgetDashboard';
import { useBudgetModuleFilters } from '@/hooks/useBudgetModuleFilters';
import { budgetModuleFiltersToQuery } from '@/lib/budgetModuleFilters';
import BudgetModuleFiltersBar from '@/components/budgets/BudgetModuleFiltersBar';
import BudgetWidgetBoard from '@/components/budgets/BudgetWidgetBoard';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';
const inputClass = 'px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';

export default function BudgetAnalyticsTab({
  departments,
  locations,
  users,
  budgetTypes,
  budgetStatuses,
  fundingSources = [],
  lifecycleStages = [],
  paymentStatuses = [],
}: {
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  users: { _id: string; name: string }[];
  budgetTypes: { id: string; name: string }[];
  budgetStatuses: { id: string; name: string }[];
  fundingSources?: { id: string; name: string }[];
  lifecycleStages?: { id: string; name: string }[];
  paymentStatuses?: { id: string; name: string }[];
}) {
  const [ctx, setCtx] = useState<BudgetDataContext | null>(null);
  const [loading, setLoading] = useState(true);
  const { filters: moduleFilters, setFilters: setModuleFilters, clearFilters } = useBudgetModuleFilters();
  const [configureMode, setConfigureMode] = useState(false);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [newDashName, setNewDashName] = useState('');
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
  } = useBudgetDashboard();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBudgetAnalytics(budgetModuleFiltersToQuery(moduleFilters));
      setCtx(data);
    } finally {
      setLoading(false);
    }
  }, [moduleFilters]);

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

  const financialYears = useMemo(
    () => Array.from(new Set(ctx?.budgets.map((b) => b.financialYear).filter(Boolean) || [])).sort().reverse(),
    [ctx?.budgets]
  );

  const handleDeleteDashboard = async () => {
    if (!activeDashboard || deleting) return;
    if (!confirm(`Delete dashboard "${activeDashboard.name}"?`)) return;
    setDeleting(true);
    try {
      await deleteDashboard(activeDashboard._id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const filterLookups = useMemo(() => {
    const fromApi = ctx?.lookups;
    return {
      budgets: fromApi?.budgets || (ctx?.budgets || []).map((b) => ({ _id: b.id, name: b.name })),
      vendors: fromApi?.vendors || [],
      projects: fromApi?.projects || Array.from(new Set((ctx?.budgets || []).map((b) => b.project).filter(Boolean))),
      costCenters: fromApi?.costCenters || Array.from(new Set((ctx?.budgets || []).map((b) => b.costCenter).filter(Boolean))),
      categories: fromApi?.categories || Array.from(new Set((ctx?.budgets || []).map((b) => b.category).filter(Boolean))),
      lifecycleStages: fromApi?.lifecycleStages || lifecycleStages,
      paymentStatuses: fromApi?.paymentStatuses || paymentStatuses,
    };
  }, [ctx, lifecycleStages, paymentStatuses]);

  if (!loaded) return <p className="text-sm text-gray-500 py-8 text-center">Loading dashboards…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select className={inputClass} value={activeDashboard?._id || ''} onChange={(e) => switchDashboard(e.target.value)}>
          {dashboards.map((d) => <option key={d._id} value={d._id}>{d.name}{d.scope === 'organization' ? ' (shared)' : ''}</option>)}
        </select>
        <button type="button" onClick={() => setShowNewDashboard((s) => !s)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>+ New dashboard</button>
        <button type="button" onClick={() => activeDashboard && duplicateDashboard(activeDashboard._id)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Duplicate</button>
        <button type="button" onClick={handleDeleteDashboard} disabled={!activeDashboard || deleting} className={`${buttonClass} border-red-500/30 text-red-400 disabled:opacity-40`}>{deleting ? 'Deleting…' : 'Delete'}</button>
        <select className={inputClass} value={activeDashboard?.autoRefresh || 'manual'} onChange={(e) => setAutoRefresh(e.target.value as 'manual' | '1m' | '5m' | '15m')}>
          {AUTO_REFRESH_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button type="button" onClick={load} className={`${buttonClass} border-blue-500/40 text-blue-300`}>Refresh</button>
        <button type="button" onClick={() => setConfigureMode((s) => !s)} className={`${buttonClass} ${configureMode ? 'bg-violet-500/20 text-violet-200 border-violet-500/40' : 'border-gray-700/60 text-gray-400'}`}>
          {configureMode ? 'Done configuring' : 'Configure widgets'}
        </button>
        {saving && <span className="text-[10px] text-gray-500">Saving layout…</span>}
      </div>

      <BudgetModuleFiltersBar
        filters={moduleFilters}
        onChange={setModuleFilters}
        onClear={clearFilters}
        showSearch={false}
        lookups={{
          budgets: filterLookups.budgets,
          budgetTypes,
          budgetStatuses,
          fundingSources,
          departments,
          locations,
          users,
          vendors: filterLookups.vendors,
          financialYears,
          projects: filterLookups.projects,
          costCenters: filterLookups.costCenters,
          categories: filterLookups.categories,
          lifecycleStages: filterLookups.lifecycleStages,
          paymentStatuses: filterLookups.paymentStatuses,
        }}
      />

      {showNewDashboard && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3 flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Dashboard name</label>
            <input className={inputClass} value={newDashName} onChange={(e) => setNewDashName(e.target.value)} placeholder="Budget overview" />
          </div>
          <button type="button" onClick={async () => { if (!newDashName.trim()) return; await createDashboard({ name: newDashName.trim(), scope: 'personal', autoRefresh: 'manual' }); setNewDashName(''); setShowNewDashboard(false); }} className={`${buttonClass} border-emerald-500/40 text-emerald-300`}>Create</button>
        </div>
      )}

      <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3">
        <p className="text-[10px] text-gray-500 uppercase mb-2">Dashboard templates</p>
        <div className="flex flex-wrap gap-2">
          {BUDGET_DASHBOARD_TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => applyDashboardTemplate(t.id)} className={`${buttonClass} border-violet-500/30 text-violet-300`} title={t.description}>{t.name}</button>
          ))}
        </div>
      </div>

      {loading || !ctx ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading budget analytics…</p>
      ) : (
        <BudgetWidgetBoard
          ctx={ctx}
          layout={layout}
          onLayoutChange={updateLayout}
          configureMode={configureMode}
          departments={departments}
          locations={locations}
          users={users}
          budgetTypes={budgetTypes}
          budgetStatuses={budgetStatuses}
          financialYears={financialYears}
          fundingSources={fundingSources}
          budgets={filterLookups.budgets}
          vendors={filterLookups.vendors}
          projects={filterLookups.projects}
          costCenters={filterLookups.costCenters}
          categories={filterLookups.categories}
          lifecycleStages={filterLookups.lifecycleStages}
          paymentStatuses={filterLookups.paymentStatuses}
          saving={saving}
        />
      )}
    </div>
  );
}
