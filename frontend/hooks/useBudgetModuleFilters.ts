'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type BudgetModuleFilters,
  emptyBudgetModuleFilters,
  fetchBudgetModuleFiltersPreference,
  saveBudgetModuleFiltersPreference,
} from '@/lib/budgetModuleFilters';

export function useBudgetModuleFilters() {
  const [filters, setFiltersState] = useState<BudgetModuleFilters>(emptyBudgetModuleFilters);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchBudgetModuleFiltersPreference()
      .then(setFiltersState)
      .finally(() => setLoaded(true));
  }, []);

  const setFilters = useCallback((patch: BudgetModuleFilters | ((prev: BudgetModuleFilters) => BudgetModuleFilters)) => {
    setFiltersState((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : patch;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveBudgetModuleFiltersPreference(next), 500);
      return next;
    });
  }, []);

  const setFilter = useCallback((key: keyof BudgetModuleFilters, value: string | undefined) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (!value) delete next[key];
      else next[key] = value;
      return next;
    });
  }, [setFilters]);

  const clearFilters = useCallback(() => setFilters(emptyBudgetModuleFilters()), [setFilters]);

  return { filters, setFilters, setFilter, clearFilters, loaded };
}
