'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'premium';
  plan: 'monthly' | 'annual';
  limits: { assets: number; users: number };
  canUpgrade: boolean;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

const PLAN_DETAILS = {
  free: {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    assets: 50,
    users: 5,
    features: ['Up to 50 assets', 'Up to 5 users/roles', 'Basic asset tracking', 'Issue reporting', 'Locations & departments'],
  },
  pro: {
    name: 'Pro',
    priceMonthly: '₹499',
    priceAnnual: '₹4,999',
    assets: 200,
    users: 10,
    features: [
      'Up to 200 assets',
      'Up to 10 users/roles',
      'KPIs & Metrics',
      'Depreciation tracking',
      'Vendor management',
      'Advanced maintenance',
      'Premium reports',
    ],
  },
  premium: {
    name: 'Premium',
    priceMonthly: '₹899',
    priceAnnual: '₹8,999',
    assets: 1000,
    users: 20,
    features: [
      'Up to 1000 assets',
      'Up to 20 users/roles',
      'Full KPIs & Metrics',
      'Complete depreciation',
      'Vendor management',
      'Priority support',
      'Custom integrations',
    ],
  },
};

const TIER_STYLES: Record<string, { badge: string; accent: string; hover: string; btn: string; price: string }> = {
  free: {
    badge: 'text-gray-300 bg-gray-500/15 border-gray-500/30',
    accent: 'border-l-gray-500/60',
    hover: 'hover:border-gray-500/25',
    btn: 'border-gray-700/60 bg-gray-800/40 text-gray-400',
    price: 'text-gray-100',
  },
  pro: {
    badge: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
    accent: 'border-l-blue-500/60',
    hover: 'hover:border-blue-500/25',
    btn: 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/50',
    price: 'text-blue-300',
  },
  premium: {
    badge: 'text-violet-300 bg-violet-500/15 border-violet-500/30',
    accent: 'border-l-violet-500/60',
    hover: 'hover:border-violet-500/25',
    btn: 'border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-400/50',
    price: 'text-violet-300',
  },
};

function formatDaysRemaining(endDate?: string): string {
  if (!endDate) return '—';
  const diff = new Date(endDate).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export default function SubscriptionsPage() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planType, setPlanType] = useState<'monthly' | 'annual'>('monthly');
  const [selectedTier, setSelectedTier] = useState<'pro' | 'premium'>('pro');
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
    loadRazorpayScript();

    // Get user role from localStorage
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserRole(user.role || null);
      }
    } catch (_) {}
  }, []);

  const loadRazorpayScript = () => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  const fetchSubscription = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Not authenticated');
      return;
    }

    try {
      const res = await fetch(api('/api/payments/subscription-status'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSubscription(data);
      } else {
        setError(data.message || 'Failed to load subscription');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier?: 'pro' | 'premium') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const tierToUpgrade = tier || selectedTier;
    setUpgrading(tierToUpgrade);
    try {
      console.log('[UPGRADE] Starting upgrade flow for:', { tier: tierToUpgrade, planType });

      // Step 1: Create order on backend
      const orderRes = await fetch(api('/api/payments/create-order'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier: tierToUpgrade, planType }),
      });

      console.log('[UPGRADE] Order response status:', orderRes.status);

      const orderData = await orderRes.json();
      console.log('[UPGRADE] Order response data:', orderData);

      if (!orderRes.ok) {
        const errorMsg = orderData.message || `Failed to create order (${orderRes.status})`;
        throw new Error(errorMsg);
      }

      if (!orderData.orderId) {
        throw new Error('No order ID returned from server');
      }

      console.log('[UPGRADE] Order created successfully:', orderData.orderId);

      // Step 2: Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: orderData.orderId,
        name: 'Resolve',
        description: `${tierToUpgrade.toUpperCase()} Plan - ${planType}`,
        image: 'https://resolve.com/logo.png',
        handler: async (response: any) => {
          // Step 3: Verify payment on backend
          try {
            const verifyRes = await fetch(api('/api/payments/verify-payment'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                orderId: orderData.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                tier: tierToUpgrade,
                planType,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.message || 'Payment verification failed');

            alert(`Successfully upgraded to ${tierToUpgrade} plan!`);
            fetchSubscription();
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Payment verification failed');
          }
        },
        prefill: {
          email: localStorage.getItem('userEmail') || '',
        },
        theme: {
          color: '#3B82F6',
        },
      };

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        alert(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upgrade failed';
      console.error('[UPGRADE] Error:', errorMsg);
      setError(errorMsg);
      alert(`Error: ${errorMsg}`);
    } finally {
      setUpgrading(null);
    }
  };

  const handleDowngrade = async () => {
    if (!confirm('Are you sure? You will lose access to pro features.')) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(api('/api/payments/cancel-subscription'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Downgrade failed');

      alert('Downgraded to free plan');
      fetchSubscription();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Downgrade failed');
    }
  };


  if (loading) {
    return <LoadingSpinner message="Loading subscription..." />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Plans & Pricing</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Choose the right plan for your organization. Upgrade anytime to unlock KPIs, depreciation, vendors, and reports.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {subscription && (
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gradient-to-r from-emerald-950/20 to-gray-800/40 px-4 py-4 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-widest mb-1">Current plan</p>
              <h2 className="text-lg font-bold text-gray-100">{PLAN_DETAILS[subscription.tier].name}</h2>
              <p className="text-[11px] text-gray-500 mt-0.5 capitalize">{subscription.plan} billing</p>
            </div>
            <span className={`shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
              subscription.tier === 'free'
                ? 'text-gray-300 bg-gray-500/15 border-gray-500/30'
                : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
            }`}>
              {subscription.tier === 'free' ? 'Free tier' : 'Active'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <SummaryCard label="Assets limit" value={String(subscription.limits.assets)} accent="text-blue-300" />
            <SummaryCard label="Users limit" value={String(subscription.limits.users)} accent="text-violet-300" />
            <SummaryCard
              label="Plan type"
              value={subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
            />
            <SummaryCard
              label="Status"
              value={subscription.tier === 'free' ? 'Forever' : formatDaysRemaining(subscription.subscriptionEndDate)}
              accent={subscription.tier === 'free' ? 'text-gray-300' : 'text-emerald-400'}
            />
          </div>

          {subscription.tier !== 'free' && subscription.subscriptionStartDate && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-gray-700/60">
              <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Started</p>
                <p className="text-xs font-medium text-gray-200 mt-0.5">
                  {new Date(subscription.subscriptionStartDate).toLocaleDateString()}
                </p>
              </div>
              <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Expires</p>
                <p className="text-xs font-medium text-gray-200 mt-0.5">
                  {subscription.subscriptionEndDate
                    ? new Date(subscription.subscriptionEndDate).toLocaleDateString()
                    : '—'}
                </p>
              </div>
            </div>
          )}

          {userRole === 'super_admin' && subscription.tier !== 'free' && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700/60">
              <button
                onClick={handleDowngrade}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-400/50 transition-colors"
              >
                Downgrade to Free
              </button>
              {subscription.tier === 'pro' && (
                <button
                  onClick={() => { setSelectedTier('premium'); setPlanType(subscription.plan as 'monthly' | 'annual'); }}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-400/50 transition-colors"
                >
                  Upgrade to Premium
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setPlanType('monthly')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            planType === 'monthly'
              ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:bg-gray-700/60 hover:text-gray-200'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setPlanType('annual')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            planType === 'annual'
              ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:bg-gray-700/60 hover:text-gray-200'
          }`}
        >
          Annual <span className="text-emerald-400/80">(save 17%)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['free', 'pro', 'premium'] as const).map((tier) => {
          const plan = PLAN_DETAILS[tier];
          const style = TIER_STYLES[tier];
          const isCurrent = subscription?.tier === tier;
          const price = tier === 'free'
            ? '₹0'
            : planType === 'monthly'
              ? (tier === 'pro' ? '₹499' : '₹899')
              : (tier === 'pro' ? '₹4,999' : '₹8,999');

          return (
            <div
              key={tier}
              className={`rounded-xl border border-gray-700/60 border-l-2 ${style.accent} bg-gray-800/40 px-4 py-4 ${style.hover} transition-colors ${
                isCurrent ? 'ring-1 ring-gray-500/40' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${style.badge}`}>
                  {plan.name}
                </span>
                {isCurrent && (
                  <span className="px-2 py-0.5 text-[11px] font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-md">
                    Current
                  </span>
                )}
              </div>

              <div className="mb-3">
                <p className={`text-2xl font-bold ${style.price}`}>{price}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {tier === 'free' ? 'forever' : planType === 'monthly' ? 'per month' : 'per year'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Assets</p>
                  <p className="text-sm font-semibold text-gray-200">{plan.assets}</p>
                </div>
                <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Users</p>
                  <p className="text-sm font-semibold text-gray-200">{plan.users}</p>
                </div>
              </div>

              <ul className="space-y-1.5 mb-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="text-emerald-400/80 mt-0.5 shrink-0">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {!isCurrent && tier !== 'free' && userRole === 'super_admin' && (
                <button
                  onClick={() => handleUpgrade(tier)}
                  disabled={upgrading === tier}
                  className={`w-full px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${style.btn}`}
                >
                  {upgrading === tier ? 'Processing…' : `Upgrade to ${plan.name}`}
                </button>
              )}

              {isCurrent && tier !== 'free' && (
                <button
                  disabled
                  className="w-full px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 bg-gray-800/60 text-gray-500 cursor-default"
                >
                  Current plan
                </button>
              )}

              {tier === 'free' && !isCurrent && (
                <p className="text-[11px] text-gray-600 text-center">Included for all organizations</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-gray-700/40 bg-gray-800/30 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Need help choosing?</p>
        <p className="text-xs text-gray-500 mb-3">
          Start free and explore the basics. Upgrade when you need more assets, users, and advanced features like KPIs, depreciation, and vendor management.
        </p>
        <Link href="/dashboard" className="text-xs text-blue-400 hover:underline">
          Go to dashboard →
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent = 'text-gray-100' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${accent}`}>{value}</p>
    </div>
  );
}









