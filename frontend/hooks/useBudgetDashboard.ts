'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createBudgetDashboard,
  deleteBudgetDashboard,
  duplicateBudgetDashboard,
  fetchActiveBudgetDashboardId,
  fetchBudgetDashboard,
  fetchBudgetDashboards,
  saveActiveBudgetDashboardId,
  updateBudgetDashboard,
} from '@/lib/budgetDashboard';
import { cloneBudgetTemplateLayout, getDefaultBudgetDashboardLayout, getTemplateById } from '@/lib/budgetDashboardTemplates';
import { mergeBudgetLayout, type BudgetDashboard, type BudgetDashboardLayout } from '@/lib/budgetWidgets';

function normalizeDashboard(dash: BudgetDashboard): BudgetDashboard {
  return { ...dash, layout: mergeBudgetLayout(dash.layout) };
}

export function useBudgetDashboard() {
  const [dashboards, setDashboards] = useState<BudgetDashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<BudgetDashboard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    const [list, activeId] = await Promise.all([
      fetchBudgetDashboards(),
      fetchActiveBudgetDashboardId(),
    ]);

    let dashList = list;
    if (!dashList.length) {
      const created = await createBudgetDashboard({
        name: 'My Budget Dashboard',
        description: 'Default budget analytics',
        scope: 'personal',
        layout: getDefaultBudgetDashboardLayout(),
        autoRefresh: 'manual',
      });
      dashList = [created];
      await saveActiveBudgetDashboardId(created._id);
    }

    setDashboards(dashList.map(normalizeDashboard));
    const targetId = activeId && dashList.some((d) => d._id === activeId) ? activeId : dashList[0]._id;
    const dash = normalizeDashboard(dashList.find((d) => d._id === targetId) || await fetchBudgetDashboard(targetId));
    setActiveDashboard(dash);
    if (targetId !== activeId) await saveActiveBudgetDashboardId(targetId);
    skipSave.current = false;
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadAll().catch(() => setLoaded(true));
  }, [loadAll]);

  const persistLayout = useCallback((dashboardId: string, layout: BudgetDashboardLayout) => {
    if (skipSave.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = normalizeDashboard(await updateBudgetDashboard(dashboardId, { layout }));
        setActiveDashboard(updated);
        setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
      } catch {
        /* ignore */
      } finally {
        setSaving(false);
      }
    }, 700);
  }, []);

  const updateLayout = useCallback(
    (patch: BudgetDashboardLayout | ((prev: BudgetDashboardLayout) => BudgetDashboardLayout)) => {
      if (!activeDashboard) return;
      setActiveDashboard((prev) => {
        if (!prev) return prev;
        const nextLayout = typeof patch === 'function' ? patch(mergeBudgetLayout(prev.layout)) : mergeBudgetLayout(patch);
        const next = { ...prev, layout: nextLayout };
        persistLayout(prev._id, nextLayout);
        return next;
      });
    },
    [activeDashboard, persistLayout]
  );

  const switchDashboard = useCallback(async (id: string) => {
    const dash = normalizeDashboard(dashboards.find((d) => d._id === id) || await fetchBudgetDashboard(id));
    skipSave.current = true;
    setActiveDashboard(dash);
    await saveActiveBudgetDashboardId(id);
    skipSave.current = false;
  }, [dashboards]);

  const createDashboard = useCallback(async (payload: Partial<BudgetDashboard>) => {
    const created = normalizeDashboard(await createBudgetDashboard(payload));
    setDashboards((prev) => [created, ...prev]);
    await switchDashboard(created._id);
    return created;
  }, [switchDashboard]);

  const duplicateDashboard = useCallback(async (id: string, name?: string) => {
    const copy = normalizeDashboard(await duplicateBudgetDashboard(id, name));
    setDashboards((prev) => [copy, ...prev]);
    await switchDashboard(copy._id);
    return copy;
  }, [switchDashboard]);

  const applyDashboardTemplate = useCallback(async (templateId: string) => {
    const tpl = getTemplateById(templateId);
    if (!tpl) return;
    const existing = dashboards.find((d) => d.scope === 'personal' && d.templateId === templateId);
    if (existing) {
      await switchDashboard(existing._id);
      return;
    }
    await createDashboard({
      name: tpl.name,
      description: tpl.description,
      scope: 'personal',
      templateId,
      layout: cloneBudgetTemplateLayout(templateId),
      autoRefresh: 'manual',
    });
  }, [dashboards, switchDashboard, createDashboard]);

  const deleteDashboard = useCallback(async (id: string) => {
    await deleteBudgetDashboard(id);
    const remaining = dashboards.filter((d) => d._id !== id);
    if (!remaining.length) {
      const created = normalizeDashboard(await createBudgetDashboard({
        name: 'My Budget Dashboard',
        scope: 'personal',
        layout: getDefaultBudgetDashboardLayout(),
        autoRefresh: 'manual',
      }));
      setDashboards([created]);
      skipSave.current = true;
      setActiveDashboard(created);
      await saveActiveBudgetDashboardId(created._id);
      skipSave.current = false;
      return;
    }
    setDashboards(remaining);
    if (activeDashboard?._id === id) await switchDashboard(remaining[0]._id);
  }, [dashboards, activeDashboard, switchDashboard]);

  const setAutoRefresh = useCallback(async (autoRefresh: BudgetDashboard['autoRefresh']) => {
    if (!activeDashboard) return;
    const updated = normalizeDashboard(await updateBudgetDashboard(activeDashboard._id, { autoRefresh }));
    setActiveDashboard(updated);
    setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
  }, [activeDashboard]);

  return {
    dashboards,
    activeDashboard,
    layout: mergeBudgetLayout(activeDashboard?.layout),
    loaded,
    saving,
    updateLayout,
    switchDashboard,
    createDashboard,
    duplicateDashboard,
    applyDashboardTemplate,
    deleteDashboard,
    setAutoRefresh,
    reload: loadAll,
  };
}
