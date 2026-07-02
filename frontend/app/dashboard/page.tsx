'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import HomeDashboardView from '@/components/home/HomeDashboardView';
import { collectAssetStatusOptions } from '@/lib/assetStatuses';
import { api, authHeaders } from '@/lib/homeDashboard';

function apiBase(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<{ _id: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<{ _id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ _id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [grpRes, tplRes, deptRes, locRes, venRes, userRes] = await Promise.all([
          fetch(apiBase('/api/asset-groups'), { headers }).then((r) => r.json()),
          fetch(apiBase('/api/asset-templates'), { headers }).then((r) => r.json()),
          fetch(apiBase('/api/departments'), { headers }).then((r) => r.json()),
          fetch(apiBase('/api/locations'), { headers }).then((r) => r.json()),
          fetch(apiBase('/api/vendors?status=Active'), { headers }).then((r) => r.json()),
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto w-full">
      <HomeDashboardView
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
