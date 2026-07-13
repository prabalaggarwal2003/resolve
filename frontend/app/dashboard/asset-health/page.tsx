'use client';

import { useEffect, useState } from 'react';
import { UpgradePrompt, fetchOrgSubscription, getStoredSubscription } from '@/lib/subscriptionUtils';
import LoadingSpinner from '@/components/LoadingSpinner';
import AssetHealthModuleNav from '@/components/asset-health/AssetHealthModuleNav';
import AssetHealthViewTab from '@/components/asset-health/AssetHealthViewTab';
import { collectAssetStatusOptions } from '@/lib/assetStatuses';
import { api } from '@/lib/assetHealth';

export default function AssetHealthPage() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [groups, setGroups] = useState<{ _id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      const sub = await fetchOrgSubscription(api);
      setTier(sub.tier);
      setIsExpired(sub.isExpired);
      if (sub.tier === 'free' || sub.isExpired) {
        setLoading(false);
        return;
      }
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [grpRes, deptRes, locRes, tplRes, healthRes] = await Promise.all([
          fetch(api('/api/asset-groups'), { headers }).then((r) => r.json()),
          fetch(api('/api/departments'), { headers }).then((r) => r.json()),
          fetch(api('/api/locations'), { headers }).then((r) => r.json()),
          fetch(api('/api/asset-templates'), { headers }).then((r) => r.json()),
          fetch(api('/api/asset-health/data'), { headers }).then((r) => r.json()),
        ]);
        setGroups(grpRes.groups || []);
        setDepartments(deptRes.departments || []);
        setLocations((locRes.locations || []).map((l: { _id: string; name: string }) => ({ _id: l._id, name: l.name })));
        const tplList = tplRes.templates || [];
        setStatusOptions(collectAssetStatusOptions(tplList));
        const cats = new Set<string>();
        (healthRes.assets || []).forEach((a: { category?: string }) => { if (a.category) cats.add(a.category); });
        tplList.forEach((t: { name?: string }) => { if (t.name) cats.add(t.name); });
        setCategories(Array.from(cats).sort());
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return <LoadingSpinner message="Loading asset health…" />;

  if (tier === 'free' || isExpired) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Asset Health</h1>
        <UpgradePrompt feature="Asset Health" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto min-w-0">
      <h1 className="text-2xl font-bold text-gray-100 mb-2">Asset Health</h1>
      <p className="text-sm text-gray-500 mb-4">Weighted health scoring with customizable widget dashboards — drag, resize, and filter each widget.</p>
      <AssetHealthModuleNav />
      <AssetHealthViewTab
        groups={groups}
        departments={departments}
        locations={locations}
        categories={categories}
        statusOptions={statusOptions}
      />
    </div>
  );
}
