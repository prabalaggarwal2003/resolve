'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createHealthDashboard,
  deleteHealthDashboard,
  fetchActiveHealthDashboardId,
  fetchHealthDashboards,
  saveActiveHealthDashboardId,
  updateHealthDashboard,
  type HealthDashboard,
} from '@/lib/assetHealth';
import { getDefaultHealthDashboardLayout, mergeHealthLayout, type HealthDashboardLayout } from '@/lib/assetHealthWidgets';

function normalize(dash: HealthDashboard): HealthDashboard {
  return { ...dash, layout: mergeHealthLayout(dash.layout) };
}

export function useAssetHealthDashboard() {
  const [dashboards, setDashboards] = useState<HealthDashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<HealthDashboard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    const [list, activeId] = await Promise.all([
      fetchHealthDashboards(),
      Promise.resolve(fetchActiveHealthDashboardId()),
    ]);

    let dashList = list;
    if (!dashList.length) {
      const created = await createHealthDashboard({
        name: 'Asset Health Dashboard',
        description: 'Default health dashboard',
        scope: 'personal',
        layout: getDefaultHealthDashboardLayout(),
        autoRefresh: 'manual',
      });
      dashList = [created];
      saveActiveHealthDashboardId(created._id);
    }

    setDashboards(dashList.map(normalize));
    const targetId = activeId && dashList.some((d) => d._id === activeId) ? activeId : dashList[0]._id;
    const dash = normalize(dashList.find((d) => d._id === targetId) || dashList[0]);
    setActiveDashboard(dash);
    if (targetId !== activeId) saveActiveHealthDashboardId(targetId);
    skipSave.current = false;
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadAll().catch(() => setLoaded(true));
  }, [loadAll]);

  const persistLayout = useCallback((dashboardId: string, layout: HealthDashboardLayout) => {
    if (skipSave.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = normalize(await updateHealthDashboard(dashboardId, { layout }));
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
    (layout: HealthDashboardLayout | ((prev: HealthDashboardLayout) => HealthDashboardLayout)) => {
      if (!activeDashboard) return;
      setActiveDashboard((prev) => {
        if (!prev) return prev;
        const nextLayout = typeof layout === 'function' ? layout(mergeHealthLayout(prev.layout)) : mergeHealthLayout(layout);
        const next = { ...prev, layout: nextLayout };
        persistLayout(prev._id, nextLayout);
        return next;
      });
    },
    [activeDashboard, persistLayout]
  );

  const switchDashboard = useCallback(
    async (id: string) => {
      const dash = dashboards.find((d) => d._id === id);
      if (!dash) return;
      skipSave.current = true;
      setActiveDashboard(normalize(dash));
      saveActiveHealthDashboardId(id);
      skipSave.current = false;
    },
    [dashboards]
  );

  const createDashboard = useCallback(async (payload: { name: string; scope?: 'personal' | 'organization'; layout?: HealthDashboardLayout }) => {
    const created = normalize(
      await createHealthDashboard({
        name: payload.name,
        scope: payload.scope || 'personal',
        layout: payload.layout || getDefaultHealthDashboardLayout(),
        autoRefresh: 'manual',
      })
    );
    setDashboards((prev) => [created, ...prev]);
    await switchDashboard(created._id);
    return created;
  }, [switchDashboard]);

  const duplicateDashboard = useCallback(async (id: string, name?: string) => {
    const source = dashboards.find((d) => d._id === id);
    if (!source) return null;
    const created = normalize(
      await createHealthDashboard({
        name: name || `${source.name} (copy)`,
        description: source.description,
        scope: 'personal',
        layout: JSON.parse(JSON.stringify(source.layout)),
        autoRefresh: source.autoRefresh || 'manual',
      })
    );
    setDashboards((prev) => [created, ...prev]);
    await switchDashboard(created._id);
    return created;
  }, [dashboards, switchDashboard]);

  const deleteDashboard = useCallback(
    async (id: string) => {
      await deleteHealthDashboard(id);
      const remaining = dashboards.filter((d) => d._id !== id);
      if (!remaining.length) {
        const created = normalize(
          await createHealthDashboard({
            name: 'Asset Health Dashboard',
            scope: 'personal',
            layout: getDefaultHealthDashboardLayout(),
            autoRefresh: 'manual',
          })
        );
        setDashboards([created]);
        skipSave.current = true;
        setActiveDashboard(created);
        saveActiveHealthDashboardId(created._id);
        skipSave.current = false;
        return;
      }
      setDashboards(remaining);
      if (activeDashboard?._id === id) {
        await switchDashboard(remaining[0]._id);
      }
    },
    [activeDashboard, dashboards, switchDashboard]
  );

  const setAutoRefresh = useCallback(
    async (autoRefresh: string) => {
      if (!activeDashboard) return;
      const updated = normalize(await updateHealthDashboard(activeDashboard._id, { autoRefresh }));
      setActiveDashboard(updated);
      setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
    },
    [activeDashboard]
  );

  const setDashboardScope = useCallback(
    async (scope: 'personal' | 'organization') => {
      if (!activeDashboard) return;
      const updated = normalize(await updateHealthDashboard(activeDashboard._id, { scope }));
      setActiveDashboard(updated);
      setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
    },
    [activeDashboard]
  );

  const saveNow = useCallback(async () => {
    if (!activeDashboard) return;
    setSaving(true);
    try {
      await updateHealthDashboard(activeDashboard._id, { layout: activeDashboard.layout });
    } finally {
      setSaving(false);
    }
  }, [activeDashboard]);

  return {
    dashboards,
    activeDashboard,
    layout: mergeHealthLayout(activeDashboard?.layout),
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
  };
}
