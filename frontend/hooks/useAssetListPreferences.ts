'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type AssetListPreferences,
  defaultPreferences,
  normalizeBasicFilters,
} from '@/lib/assetsTableConfig';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function mergePreferences(incoming: Partial<AssetListPreferences> | null): AssetListPreferences {
  const base = defaultPreferences();
  if (!incoming) return base;
  return {
    ...base,
    ...incoming,
    columns: incoming.columns?.length ? incoming.columns : base.columns,
    savedViews: incoming.savedViews ?? base.savedViews,
    advancedFilters: incoming.advancedFilters ?? base.advancedFilters,
    basicFilters: normalizeBasicFilters(incoming.basicFilters),
  };
}

export function useAssetListPreferences() {
  const [prefs, setPrefs] = useState<AssetListPreferences>(defaultPreferences);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoaded(true);
      return;
    }
    fetch(api('/api/users/me/preferences/assets-list'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setPrefs(mergePreferences(data.preferences));
      })
      .catch(() => {})
      .finally(() => {
        skipSave.current = false;
        setLoaded(true);
      });
  }, []);

  const persist = useCallback((next: AssetListPreferences) => {
    if (skipSave.current) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(api('/api/users/me/preferences/assets-list'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(next),
      }).catch(() => {});
    }, 600);
  }, []);

  const updatePrefs = useCallback(
    (patch: Partial<AssetListPreferences> | ((prev: AssetListPreferences) => AssetListPreferences)) => {
      setPrefs((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { prefs, updatePrefs, loaded };
}
