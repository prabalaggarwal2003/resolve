'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createPartnerDashboard,
  deletePartnerDashboard,
  duplicatePartnerDashboard,
  fetchActivePartnerDashboardId,
  fetchPartnerDashboard,
  fetchPartnerDashboards,
  saveActivePartnerDashboardId,
  updatePartnerDashboard,
} from '@/lib/businessPartners';
import {
  getDefaultPartnerDashboardLayout,
  mergePartnerLayout,
  type PartnerDashboard,
  type PartnerDashboardLayout,
} from '@/lib/partnerDashboardWidgets';

function normalizeDashboard(dash: PartnerDashboard): PartnerDashboard {
  return { ...dash, layout: mergePartnerLayout(dash.layout) };
}

export function usePartnerDashboard() {
  const [dashboards, setDashboards] = useState<PartnerDashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<PartnerDashboard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    const [list, activeId] = await Promise.all([fetchPartnerDashboards(), fetchActivePartnerDashboardId()]);

    let dashList = list as PartnerDashboard[];
    if (!dashList.length) {
      const created = await createPartnerDashboard({
        name: 'Partners Overview',
        description: 'Default business partners dashboard',
        scope: 'organization',
        layout: getDefaultPartnerDashboardLayout(),
        autoRefresh: 'manual',
      });
      dashList = [created];
      await saveActivePartnerDashboardId(created._id);
    }

    setDashboards(dashList.map(normalizeDashboard));
    const targetId = activeId && dashList.some((d) => d._id === activeId) ? activeId : dashList[0]._id;
    const dash = normalizeDashboard(
      dashList.find((d) => d._id === targetId) || (await fetchPartnerDashboard(targetId))
    );
    setActiveDashboard(dash);
    if (targetId !== activeId) await saveActivePartnerDashboardId(targetId);
    skipSave.current = false;
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadAll().catch(() => setLoaded(true));
  }, [loadAll]);

  const persistLayout = useCallback((dashboardId: string, layout: PartnerDashboardLayout) => {
    if (skipSave.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = normalizeDashboard(await updatePartnerDashboard(dashboardId, { layout }));
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
    (patch: PartnerDashboardLayout | ((prev: PartnerDashboardLayout) => PartnerDashboardLayout)) => {
      if (!activeDashboard) return;
      setActiveDashboard((prev) => {
        if (!prev) return prev;
        const nextLayout =
          typeof patch === 'function' ? patch(mergePartnerLayout(prev.layout)) : mergePartnerLayout(patch);
        persistLayout(prev._id, nextLayout);
        return { ...prev, layout: nextLayout };
      });
    },
    [activeDashboard, persistLayout]
  );

  const switchDashboard = useCallback(
    async (id: string) => {
      const dash = normalizeDashboard(
        dashboards.find((d) => d._id === id) || (await fetchPartnerDashboard(id))
      );
      skipSave.current = true;
      setActiveDashboard(dash);
      await saveActivePartnerDashboardId(id);
      skipSave.current = false;
    },
    [dashboards]
  );

  const createDashboard = useCallback(
    async (payload: Partial<PartnerDashboard>) => {
      const created = normalizeDashboard(
        await createPartnerDashboard({
          name: payload.name || 'New dashboard',
          description: payload.description || '',
          scope: payload.scope || 'personal',
          layout: payload.layout || getDefaultPartnerDashboardLayout(),
          autoRefresh: payload.autoRefresh || 'manual',
        })
      );
      setDashboards((prev) => [created, ...prev]);
      await switchDashboard(created._id);
      return created;
    },
    [switchDashboard]
  );

  const duplicateDashboard = useCallback(
    async (id: string, name?: string) => {
      const copy = normalizeDashboard(await duplicatePartnerDashboard(id, name));
      setDashboards((prev) => [copy, ...prev]);
      await switchDashboard(copy._id);
      return copy;
    },
    [switchDashboard]
  );

  const deleteDashboard = useCallback(
    async (id: string) => {
      await deletePartnerDashboard(id);
      const remaining = dashboards.filter((d) => d._id !== id);
      setDashboards(remaining);
      if (activeDashboard?._id === id) {
        if (remaining.length) await switchDashboard(remaining[0]._id);
        else {
          const created = await createDashboard({
            name: 'Partners Overview',
            scope: 'organization',
            layout: getDefaultPartnerDashboardLayout(),
          });
          return created;
        }
      }
    },
    [activeDashboard?._id, createDashboard, dashboards, switchDashboard]
  );

  const setAutoRefresh = useCallback(
    async (autoRefresh: PartnerDashboard['autoRefresh']) => {
      if (!activeDashboard || !autoRefresh) return;
      const updated = normalizeDashboard(
        await updatePartnerDashboard(activeDashboard._id, { autoRefresh })
      );
      setActiveDashboard(updated);
      setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
    },
    [activeDashboard]
  );

  const setDashboardScope = useCallback(
    async (scope: 'personal' | 'organization') => {
      if (!activeDashboard) return;
      const updated = normalizeDashboard(await updatePartnerDashboard(activeDashboard._id, { scope }));
      setActiveDashboard(updated);
      setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
    },
    [activeDashboard]
  );

  const saveNow = useCallback(async () => {
    if (!activeDashboard) return;
    setSaving(true);
    try {
      const updated = normalizeDashboard(
        await updatePartnerDashboard(activeDashboard._id, {
          name: activeDashboard.name,
          layout: activeDashboard.layout,
          autoRefresh: activeDashboard.autoRefresh,
          scope: activeDashboard.scope,
        })
      );
      setActiveDashboard(updated);
      setDashboards((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
    } finally {
      setSaving(false);
    }
  }, [activeDashboard]);

  return {
    dashboards,
    activeDashboard,
    layout: activeDashboard ? mergePartnerLayout(activeDashboard.layout) : getDefaultPartnerDashboardLayout(),
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
    reload: loadAll,
  };
}
