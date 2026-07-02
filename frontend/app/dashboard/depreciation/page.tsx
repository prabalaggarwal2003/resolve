'use client';

import { useEffect, useState } from 'react';
import { UpgradePrompt, fetchOrgSubscription, getStoredSubscription } from '@/lib/subscriptionUtils';
import LoadingSpinner from '@/components/LoadingSpinner';
import DepreciationViewTab from '@/components/depreciation/DepreciationViewTab';
import DepreciationEditTab from '@/components/depreciation/DepreciationEditTab';
import { collectAssetStatusOptions } from '@/lib/assetStatuses';
import { canWrite } from '@/lib/permissions';
import { api, authHeaders, type DepreciationPolicy } from '@/lib/depreciation';

const buttonClass = 'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors';

function apiBase(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function DepreciationPage() {
  const [tab, setTab] = useState<'view' | 'edit'>('view');
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [policies, setPolicies] = useState<DepreciationPolicy[]>([]);
  const [groups, setGroups] = useState<{ _id: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<{ _id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ _id: string; name: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  const canEdit = canWrite('depreciation');

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
        const [polRes, grpRes, tplRes, deptRes, locRes, venRes] = await Promise.all([
          fetch(api('/api/depreciation/policies'), { headers: authHeaders() }).then((r) => r.json()),
          fetch(api('/api/asset-groups'), { headers }).then((r) => r.json()),
          fetch(api('/api/asset-templates'), { headers }).then((r) => r.json()),
          fetch(api('/api/departments'), { headers }).then((r) => r.json()),
          fetch(api('/api/locations'), { headers }).then((r) => r.json()),
          fetch(api('/api/vendors?status=Active'), { headers }).then((r) => r.json()),
        ]);
        setPolicies(polRes.policies || []);
        setGroups(grpRes.groups || []);
        const tplList = tplRes.templates || [];
        setTemplates(tplList.map((t: { _id: string; name: string }) => ({ _id: t._id, name: t.name })));
        setStatusOptions(collectAssetStatusOptions(tplList));
        setDepartments(deptRes.departments || []);
        setLocations((locRes.locations || []).map((l: { _id: string; name: string }) => ({ _id: l._id, name: l.name })));
        setVendors(Array.isArray(venRes) ? venRes.map((v: { _id: string; name: string }) => ({ _id: v._id, name: v.name })) : []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return <LoadingSpinner message="Loading depreciation…" />;

  if (tier === 'free' || isExpired) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Depreciation</h1>
        <UpgradePrompt feature="Depreciation & book value" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Depreciation</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Policy-based SLM & WDV book values, dashboards, and operational health indicators.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('view')}
            className={`${buttonClass} ${tab === 'view' ? 'bg-blue-500/20 text-blue-200 border-blue-500/40' : 'border-gray-700/60 text-gray-400'}`}
          >
            Dashboard & metrics
          </button>
          <button
            type="button"
            onClick={() => setTab('edit')}
            className={`${buttonClass} ${tab === 'edit' ? 'bg-violet-500/20 text-violet-200 border-violet-500/40' : 'border-gray-700/60 text-gray-400'}`}
          >
            Policies & settings
          </button>
        </div>
      </div>

      {tab === 'view' ? (
        <DepreciationViewTab
          policies={policies}
          groups={groups}
          templates={templates}
          departments={departments}
          locations={locations}
          vendors={vendors}
          statusOptions={statusOptions}
        />
      ) : (
        <DepreciationEditTab groups={groups} canEdit={canEdit} />
      )}
    </div>
  );
}
