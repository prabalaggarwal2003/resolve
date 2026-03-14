'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function SubscriptionBanner() {
  const [status, setStatus] = useState<{ isExpired: boolean; daysRemaining: number | null } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(api('/api/payments/subscription-status'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({
          isExpired: data.isExpired || false,
          daysRemaining: data.daysRemaining,
        });
      }
    } catch (_) {}
  };

  if (!status?.isExpired) return null;

  return (
    <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-semibold text-red-400 text-lg">⚠️ Subscription Expired</p>
          <p className="text-red-300 text-sm mt-2">
            Your subscription has expired. Your account is now operating on the Free plan with limits of 50 assets and 5 users.
            KPIs and Depreciation tracking are locked.
          </p>
          <p className="text-red-300 text-xs mt-2 opacity-75">
            Renew your subscription to restore access to Pro/Premium features.
          </p>
        </div>
        <Link
          href="/dashboard/subscriptions"
          className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors text-nowrap shrink-0"
        >
          Renew Now →
        </Link>
      </div>
    </div>
  );
}

