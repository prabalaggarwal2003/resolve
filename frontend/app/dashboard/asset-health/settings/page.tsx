'use client';

import { useEffect, useState } from 'react';
import { UpgradePrompt, fetchOrgSubscription, getStoredSubscription } from '@/lib/subscriptionUtils';
import LoadingSpinner from '@/components/LoadingSpinner';
import AssetHealthModuleNav from '@/components/asset-health/AssetHealthModuleNav';
import AssetHealthSettingsForm from '@/components/asset-health/AssetHealthSettingsForm';
import { api } from '@/lib/assetHealth';

export default function AssetHealthSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [groups, setGroups] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    const init = async () => {
      const sub = await fetchOrgSubscription(api);
      setTier(sub.tier);
      setIsExpired(sub.isExpired);
      if (sub.tier !== 'free' && !sub.isExpired) {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const res = await fetch(api('/api/asset-groups'), { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setGroups(data.groups || []);
          } catch {
            setGroups([]);
          }
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  if (loading) return <LoadingSpinner message="Loading…" />;

  if (tier === 'free' || isExpired) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Asset Health Settings</h1>
        <UpgradePrompt feature="Asset Health" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto min-w-0">
      <h1 className="text-2xl font-bold text-gray-100 mb-2">Asset Health</h1>
      <AssetHealthModuleNav />
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Health Score Settings</h2>
      <AssetHealthSettingsForm groups={groups} />
    </div>
  );
}
