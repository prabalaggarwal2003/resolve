'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type DepreciationDashboardLayout,
  defaultDashboardLayout,
  mergeDashboardLayout,
} from '@/lib/depreciationWidgets';
import { api, authHeaders } from '@/lib/depreciation';

export function useDepreciationDashboardLayout() {
  const [layout, setLayout] = useState<DepreciationDashboardLayout>(() => defaultDashboardLayout());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(api('/api/users/me/preferences/depreciation-dashboard'), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setLayout(mergeDashboardLayout(data.layout)))
      .catch(() => {})
      .finally(() => {
        skipSave.current = false;
        setLoaded(true);
      });
  }, []);

  const persist = useCallback((next: DepreciationDashboardLayout) => {
    if (skipSave.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      fetch(api('/api/users/me/preferences/depreciation-dashboard'), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ layout: next }),
      })
        .catch(() => {})
        .finally(() => setSaving(false));
    }, 700);
  }, []);

  const updateLayout = useCallback(
    (patch: DepreciationDashboardLayout | ((prev: DepreciationDashboardLayout) => DepreciationDashboardLayout)) => {
      setLayout((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : patch;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const saveNow = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(api('/api/users/me/preferences/depreciation-dashboard'), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ layout }),
      });
    } finally {
      setSaving(false);
    }
  }, [layout]);

  return { layout, updateLayout, loaded, saving, saveNow };
}
