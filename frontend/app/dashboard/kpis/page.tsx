'use client';

import { useEffect, useState } from 'react';
import { UpgradePrompt, fetchOrgSubscription, getStoredSubscription } from '@/lib/subscriptionUtils';
import LoadingSpinner from '@/components/LoadingSpinner';
import KpiViewTab from '@/components/kpis/KpiViewTab';
import { collectAssetStatusOptions } from '@/lib/assetStatuses';
import { api, authHeaders } from '@/lib/kpi';

function apiBase(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function KPIsPage() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [groups, setGroups] = useState<{ _id: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<{ _id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ _id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      const sub = await fetchOrgSubscription(apiBase);
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
        const [grpRes, tplRes, deptRes, locRes, venRes, userRes] = await Promise.all([
          fetch(api('/api/asset-groups'), { headers }).then((r) => r.json()),
          fetch(api('/api/asset-templates'), { headers }).then((r) => r.json()),
          fetch(api('/api/departments'), { headers }).then((r) => r.json()),
          fetch(api('/api/locations'), { headers }).then((r) => r.json()),
          fetch(api('/api/vendors?status=Active'), { headers }).then((r) => r.json()),
          fetch(api('/api/users'), { headers: authHeaders() }).then((r) => r.json()),
        ]);
        setGroups(grpRes.groups || []);
        const tplList = tplRes.templates || [];
        setTemplates(tplList.map((t: { _id: string; name: string }) => ({ _id: t._id, name: t.name })));
        setStatusOptions(collectAssetStatusOptions(tplList));
        setDepartments(deptRes.departments || []);
        setLocations((locRes.locations || []).map((l: { _id: string; name: string }) => ({ _id: l._id, name: l.name })));
        setVendors(Array.isArray(venRes) ? venRes.map((v: { _id: string; name: string }) => ({ _id: v._id, name: v.name })) : []);
        setUsers((userRes.users || []).map((u: { _id: string; name: string }) => ({ _id: u._id, name: u.name })));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return <LoadingSpinner message="Loading KPIs…" />;

  if (tier === 'free' || isExpired) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-100 mb-6">KPIs & Metrics</h1>
        <UpgradePrompt feature="KPIs & Metrics" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-100 mb-2">KPIs & Metrics</h1>
      <p className="text-sm text-gray-500 mb-6">Customizable widget dashboard — drag, resize, and filter each widget independently.</p>
      <KpiViewTab
        groups={groups}
        templates={templates}
        departments={departments}
        locations={locations}
        vendors={vendors}
        users={users}
        statusOptions={statusOptions}
      />
    </div>
  );
}
