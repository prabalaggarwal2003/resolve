'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createKpiDashboard,
  deleteKpiDashboard,
  duplicateKpiDashboard,
  fetchActiveKpiDashboardId,
  fetchKpiDashboard,
  fetchKpiDashboards,
  saveActiveKpiDashboardId,
  updateKpiDashboard,
  type KpiSummaryResponse,
} from '@/lib/kpi';
import { cloneKpiTemplateLayout, getDefaultKpiDashboardLayout, getTemplateById } from '@/lib/kpiDashboardTemplates';
import { mergeKpiLayout, type KpiDashboard, type KpiDashboardLayout } from '@/lib/kpiWidgets';

function normalizeDashboard(dash: KpiDashboard): KpiDashboard {
  return { ...dash, layout: mergeKpiLayout(dash.layout) };
}

export function useKpiDashboard() {
  const [dashboards, setDashboards] = useState<KpiDashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<KpiDashboard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    const [list, activeId] = await Promise.all([
      fetchKpiDashboards(),
      fetchActiveKpiDashboardId(),
    ]);

    let dashList = list;
    if (!dashList.length) {
      const created = await createKpiDashboard({
        name: 'My KPI Dashboard',
        description: 'Default dashboard',
        scope: 'personal',
        layout: getDefaultKpiDashboardLayout(),
        autoRefresh: 'manual',
      });
      dashList = [created];
      await saveActiveKpiDashboardId(created._id);
    }

    setDashboards(dashList.map(normalizeDashboard));
    const targetId = activeId && dashList.some((d) => d._id === activeId)
      ? activeId
      : dashList[0]._id;
    const dash = normalizeDashboard(dashList.find((d) => d._id === targetId) || await fetchKpiDashboard(targetId));
    setActiveDashboard(dash);
    if (targetId !== activeId) await saveActiveKpiDashboardId(targetId);
    skipSave.current = false;
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadAll().catch(() => setLoaded(true));
  }, [loadAll]);

  const persistLayout = useCallback((dashboardId: string, layout: KpiDashboardLayout) => {
    if (skipSave.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = normalizeDashboard(await updateKpiDashboard(dashboardId, { layout }));
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
    (patch: KpiDashboardLayout | ((prev: KpiDashboardLayout) => KpiDashboardLayout)) => {
      if (!activeDashboard) return;
      setActiveDashboard((prev) => {
        if (!prev) return prev;
        const nextLayout = typeof patch === 'function'
          ? patch(mergeKpiLayout(prev.layout))
          : mergeKpiLayout(patch);
        const next = { ...prev, layout: nextLayout };
        persistLayout(prev._id, nextLayout);
        return next;
      });
    },
    [activeDashboard, persistLayout]
  );

  const switchDashboard = useCallback(async (id: string) => {
    const dash = normalizeDashboard(dashboards.find((d) => d._id === id) || await fetchKpiDashboard(id));
    skipSave.current = true;
    setActiveDashboard(dash);
    await saveActiveKpiDashboardId(id);
    skipSave.current = false;
  }, [dashboards]);

  const createDashboard = useCallback(async (payload: Partial<KpiDashboard>) => {
    const created = normalizeDashboard(await createKpiDashboard(payload));
    setDashboards((prev) => [created, ...prev]);
    await switchDashboard(created._id);
    return created;
  }, [switchDashboard]);

  const duplicateDashboard = useCallback(async (id: string, name?: string) => {
    const copy = normalizeDashboard(await duplicateKpiDashboard(id, name));
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
      layout: cloneKpiTemplateLayout(tpl.layout),
      autoRefresh: 'manual',
    });
  }, [dashboards, switchDashboard, createDashboard]);

  const deleteDashboard = useCallback(async (id: string) => {
    await deleteKpiDashboard(id);
    const remaining = dashboards.filter((d) => d._id !== id);

    if (!remaining.length) {
      const created = normalizeDashboard(await createKpiDashboard({
        name: 'My KPI Dashboard',
        description: 'Default dashboard',
        scope: 'personal',
        layout: getDefaultKpiDashboardLayout(),
        autoRefresh: 'manual',
      }));
      setDashboards([created]);
      skipSave.current = true;
      setActiveDashboard(created);
      await saveActiveKpiDashboardId(created._id);
      skipSave.current = false;
      return;
    }

    setDashboards(remaining);
    if (activeDashboard?._id === id) {
      await switchDashboard(remaining[0]._id);
    }
  }, [dashboards, activeDashboard, switchDashboard]);

  const setAutoRefresh = useCallback(async (autoRefresh: KpiDashboard['autoRefresh']) => {
    if (!activeDashboard) return;
    const updated = await updateKpiDashboard(activeDashboard._id, { autoRefresh });
    setActiveDashboard(updated);
    setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
  }, [activeDashboard]);

  const setDashboardScope = useCallback(async (scope: 'personal' | 'organization') => {
    if (!activeDashboard) return;
    const updated = await updateKpiDashboard(activeDashboard._id, { scope });
    setActiveDashboard(updated);
    setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
  }, [activeDashboard]);

  const saveNow = useCallback(async () => {
    if (!activeDashboard) return;
    setSaving(true);
    try {
      await updateKpiDashboard(activeDashboard._id, { layout: activeDashboard.layout });
    } finally {
      setSaving(false);
    }
  }, [activeDashboard]);

  return {
    dashboards,
    activeDashboard,
    layout: mergeKpiLayout(activeDashboard?.layout),
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
    reload: loadAll,
  };
}

export type { KpiSummaryResponse };
