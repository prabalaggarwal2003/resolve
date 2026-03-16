'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'premium';
  isExpired: boolean;
  daysRemaining: number | null;
  subscriptionEndDate?: string;
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function SubscriptionBanner() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [isExpiringsSoon, setIsExpiringsSoon] = useState(false);

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
          tier: data.tier || 'free',
          isExpired: data.isExpired || false,
          daysRemaining: data.daysRemaining,
          subscriptionEndDate: data.subscriptionEndDate,
        });

        // Check if expiring soon (7 days or less)
        if (!data.isExpired && data.daysRemaining !== null && data.daysRemaining <= 7 && data.daysRemaining > 0) {
          setIsExpiringsSoon(true);
        }
      }
    } catch (_) {}
  };

  if (!status || (status.tier === 'free' && !status.isExpired)) return null;

  // Expired subscription banner
  if (status.isExpired && status.tier !== 'free') {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-red-300 text-lg">Subscription Expired</p>
              <p className="text-red-400 text-sm mt-1">
                Your {status.tier.toUpperCase()} subscription expired on {status.subscriptionEndDate ? new Date(status.subscriptionEndDate).toLocaleDateString() : 'unknown date'}. Your account is now operating on the Free plan with limits of 50 assets and 5 users. KPIs and Depreciation tracking are locked.
              </p>
              <p className="text-red-400 text-xs mt-2 opacity-75">
                Renew your subscription to restore access to Pro/Premium features.
              </p>
            </div>
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

  // Expiring soon warning banner
  if (isExpiringsSoon && status.daysRemaining !== null && status.tier !== 'free') {
    return (
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <span className="text-2xl">⏰</span>
            <div>
              <p className="font-semibold text-yellow-300 text-lg">Subscription Expiring Soon</p>
              <p className="text-yellow-400 text-sm mt-1">
                Your {status.tier.toUpperCase()} plan expires in {status.daysRemaining} day{status.daysRemaining !== 1 ? 's' : ''} on {status.subscriptionEndDate ? new Date(status.subscriptionEndDate).toLocaleDateString() : 'unknown date'}. Renew to avoid losing access to premium features.
              </p>
              <p className="text-yellow-400 text-xs mt-2 opacity-75">
                Once expired, your account will revert to the Free plan with limited features.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/subscriptions"
            className="ml-4 px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors text-nowrap shrink-0"
          >
            Renew Now →
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
