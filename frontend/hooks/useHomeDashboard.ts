'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createHomeDashboard,
  deleteHomeDashboard,
  duplicateHomeDashboard,
  fetchActiveHomeDashboardId,
  fetchHomeDashboard,
  fetchHomeDashboards,
  saveActiveHomeDashboardId,
  updateHomeDashboard,
} from '@/lib/homeDashboard';
import { cloneHomeTemplateLayout, getDefaultHomeDashboardLayout, getTemplateById } from '@/lib/homeDashboardTemplates';
import { mergeHomeLayout, type HomeDashboard, type HomeDashboardLayout } from '@/lib/homeDashboardWidgets';

function normalizeDashboard(dash: HomeDashboard): HomeDashboard {
  return { ...dash, layout: mergeHomeLayout(dash.layout), theme: dash.theme || 'comfortable' };
}

export function useHomeDashboard() {
  const [dashboards, setDashboards] = useState<HomeDashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<HomeDashboard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    const [list, activeId] = await Promise.all([
      fetchHomeDashboards(),
      fetchActiveHomeDashboardId(),
    ]);

    let dashList = list;
    if (!dashList.length) {
      const created = await createHomeDashboard({
        name: 'My Home Dashboard',
        description: 'Default dashboard',
        scope: 'personal',
        layout: getDefaultHomeDashboardLayout(),
        autoRefresh: 'manual',
        theme: 'comfortable',
      });
      dashList = [created];
      await saveActiveHomeDashboardId(created._id);
    }

    setDashboards(dashList.map(normalizeDashboard));
    const targetId = activeId && dashList.some((d) => d._id === activeId)
      ? activeId
      : dashList[0]._id;
    const dash = normalizeDashboard(dashList.find((d) => d._id === targetId) || await fetchHomeDashboard(targetId));
    setActiveDashboard(dash);
    if (targetId !== activeId) await saveActiveHomeDashboardId(targetId);
    skipSave.current = false;
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadAll().catch(() => setLoaded(true));
  }, [loadAll]);

  const persistLayout = useCallback((dashboardId: string, layout: HomeDashboardLayout) => {
    if (skipSave.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = normalizeDashboard(await updateHomeDashboard(dashboardId, { layout }));
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
    (patch: HomeDashboardLayout | ((prev: HomeDashboardLayout) => HomeDashboardLayout)) => {
      if (!activeDashboard) return;
      setActiveDashboard((prev) => {
        if (!prev) return prev;
        const nextLayout = typeof patch === 'function'
          ? patch(mergeHomeLayout(prev.layout))
          : mergeHomeLayout(patch);
        const next = { ...prev, layout: nextLayout };
        persistLayout(prev._id, nextLayout);
        return next;
      });
    },
    [activeDashboard, persistLayout]
  );

  const switchDashboard = useCallback(async (id: string) => {
    const dash = normalizeDashboard(dashboards.find((d) => d._id === id) || await fetchHomeDashboard(id));
    skipSave.current = true;
    setActiveDashboard(dash);
    await saveActiveHomeDashboardId(id);
    skipSave.current = false;
  }, [dashboards]);

  const createDashboard = useCallback(async (payload: Partial<HomeDashboard>) => {
    const created = normalizeDashboard(await createHomeDashboard(payload));
    setDashboards((prev) => [created, ...prev]);
    await switchDashboard(created._id);
    return created;
  }, [switchDashboard]);

  const duplicateDashboard = useCallback(async (id: string, name?: string) => {
    const copy = normalizeDashboard(await duplicateHomeDashboard(id, name));
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
      layout: cloneHomeTemplateLayout(tpl.layout),
      autoRefresh: 'manual',
      theme: 'comfortable',
    });
  }, [dashboards, switchDashboard, createDashboard]);

  const deleteDashboard = useCallback(async (id: string) => {
    await deleteHomeDashboard(id);
    const remaining = dashboards.filter((d) => d._id !== id);

    if (!remaining.length) {
      const created = normalizeDashboard(await createHomeDashboard({
        name: 'My Home Dashboard',
        description: 'Default dashboard',
        scope: 'personal',
        layout: getDefaultHomeDashboardLayout(),
        autoRefresh: 'manual',
        theme: 'comfortable',
      }));
      setDashboards([created]);
      skipSave.current = true;
      setActiveDashboard(created);
      await saveActiveHomeDashboardId(created._id);
      skipSave.current = false;
      return;
    }

    setDashboards(remaining);
    if (activeDashboard?._id === id) {
      await switchDashboard(remaining[0]._id);
    }
  }, [dashboards, activeDashboard, switchDashboard]);

  const setAutoRefresh = useCallback(async (autoRefresh: HomeDashboard['autoRefresh']) => {
    if (!activeDashboard) return;
    const updated = normalizeDashboard(await updateHomeDashboard(activeDashboard._id, { autoRefresh }));
    setActiveDashboard(updated);
    setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
  }, [activeDashboard]);

  const setDashboardScope = useCallback(async (scope: 'personal' | 'organization') => {
    if (!activeDashboard) return;
    const updated = normalizeDashboard(await updateHomeDashboard(activeDashboard._id, { scope }));
    setActiveDashboard(updated);
    setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
  }, [activeDashboard]);

  const setTheme = useCallback(async (theme: 'comfortable' | 'compact') => {
    if (!activeDashboard) return;
    const updated = normalizeDashboard(await updateHomeDashboard(activeDashboard._id, { theme }));
    setActiveDashboard(updated);
    setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
  }, [activeDashboard]);

  const saveNow = useCallback(async () => {
    if (!activeDashboard) return;
    setSaving(true);
    try {
      await updateHomeDashboard(activeDashboard._id, { layout: activeDashboard.layout });
    } finally {
      setSaving(false);
    }
  }, [activeDashboard]);

  return {
    dashboards,
    activeDashboard,
    layout: mergeHomeLayout(activeDashboard?.layout),
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
    setTheme,
    saveNow,
    reload: loadAll,
  };
}
