'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import BudgetModuleNav from '@/components/budgets/BudgetModuleNav';
import BudgetModuleFiltersBar from '@/components/budgets/BudgetModuleFiltersBar';
import BudgetHistoryTimeline from '@/components/budgets/BudgetHistoryTimeline';
import { useBudgetModuleFilters } from '@/hooks/useBudgetModuleFilters';
import { budgetModuleFiltersToQuery } from '@/lib/budgetModuleFilters';
import {
  fetchBudgetConfig,
  fetchBudgets,
  fetchOrganizationBudgetHistory,
  type Budget,
  type BudgetHistoryEntry,
  type BudgetOrgConfig,
} from '@/lib/budgets';
import { UpgradePrompt, canAccessFeature, fetchOrgSubscription, getStoredSubscription } from '@/lib/subscriptionUtils';
import { api } from '@/lib/budgets';

export default function BudgetHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [config, setConfig] = useState<BudgetOrgConfig | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [history, setHistory] = useState<BudgetHistoryEntry[]>([]);
  const [eventType, setEventType] = useState('');
  const [error, setError] = useState('');

  const { filters: moduleFilters, setFilters: setModuleFilters, clearFilters, loaded } = useBudgetModuleFilters();
  const hasAccess = canAccessFeature(tier, 'budgets') && !isExpired;
  const appliedUrlFilter = useRef(false);

  useEffect(() => {
    if (!loaded || appliedUrlFilter.current || typeof window === 'undefined') return;
    appliedUrlFilter.current = true;
    const budgetId = new URLSearchParams(window.location.search).get('budgetId');
    if (budgetId) setModuleFilters((f) => ({ ...f, budgetId }));
  }, [loaded, setModuleFilters]);

  const financialYears = useMemo(
    () => Array.from(new Set(budgets.map((b) => b.financialYear).filter(Boolean) as string[])).sort().reverse(),
    [budgets]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = budgetModuleFiltersToQuery(moduleFilters);
      if (eventType) params.eventType = eventType;
      const [cfg, budgetList, hist] = await Promise.all([
        fetchBudgetConfig(),
        fetchBudgets(),
        fetchOrganizationBudgetHistory(params),
      ]);
      setConfig(cfg);
      setBudgets(budgetList);
      setHistory(hist);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [moduleFilters, eventType]);

  useEffect(() => {
    fetchOrgSubscription(api).then((sub) => {
      setTier(sub.tier);
      setIsExpired(sub.isExpired);
    });
  }, []);

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    load();
  }, [hasAccess, load]);

  if (!hasAccess) {
    return (
      <div className="p-4">
        <UpgradePrompt feature="Budgets & Procurement" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      <BudgetModuleNav />

      <div>
        <h1 className="text-lg font-semibold text-gray-100">Budget history</h1>
        <p className="text-sm text-gray-500 mt-0.5">Organization-wide audit trail for budget and procurement events</p>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>
      )}

      <BudgetModuleFiltersBar
        filters={moduleFilters}
        onChange={setModuleFilters}
        onClear={clearFilters}
        showSearch={false}
        lookups={{
          budgets: budgets.map((b) => ({ _id: b._id, name: b.name })),
          budgetTypes: config?.budgetTypes || [],
          budgetStatuses: config?.budgetStatuses || [],
          fundingSources: config?.fundingSources || [],
          departments: [],
          locations: [],
          users: [],
          financialYears,
        }}
        extra={
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Event type</label>
            <select
              className="px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 min-w-[120px]"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="">All events</option>
              <optgroup label="Budget">
                <option value="budget_created">Created</option>
                <option value="budget_updated">Updated</option>
                <option value="allocation_increased">Allocation increased</option>
                <option value="allocation_reduced">Allocation reduced</option>
                <option value="status_changed">Status changed</option>
                <option value="budget_closed">Budget closed</option>
                <option value="note_added">Note added</option>
              </optgroup>
              <optgroup label="Procurement">
                <option value="procurement_created">Purchase created</option>
                <option value="procurement_updated">Purchase updated</option>
                <option value="procurement_deleted">Purchase deleted</option>
                <option value="purchase_linked">Purchase linked</option>
                <option value="purchase_cancelled">Purchase cancelled</option>
              </optgroup>
            </select>
          </div>
        }
      />

      <div className="rounded-xl border border-gray-800/80 bg-gray-900/20 p-4">
        {loading ? (
          <LoadingSpinner message="Loading history…" />
        ) : (
          <BudgetHistoryTimeline entries={history} showBudgetName />
        )}
      </div>
    </div>
  );
}
