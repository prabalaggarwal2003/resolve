'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PartnerActivityList, { type PartnerActivityItem } from '@/components/partners/PartnerActivityList';
import { fetchPartnerActivity } from '@/lib/businessPartners';

export default function PartnerActivityPage() {
  const [activities, setActivities] = useState<PartnerActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPartnerActivity(150)
      .then(setActivities)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading activity..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Activity</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Field-level changes across partners, including who made each update
        </p>
      </div>
      <div className="rounded-xl border border-gray-700/60 bg-gray-900/30 p-4">
        <PartnerActivityList activities={activities} showPartner />
      </div>
    </div>
  );
}
