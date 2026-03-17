'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
    color: 'gray',
    badge: 'Current Plan',
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
      'Advanced maintenance',
      'Premium reports',
    ],
    color: 'blue',
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
      'Priority support',
      'Custom integrations',
    ],
    color: 'purple',
  },
};

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
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
        <span className="ml-3 text-gray-400">Loading subscription...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Plans & Pricing</h1>
        <p className="text-gray-400">Choose the perfect plan for your organization.</p>
      </div>

      {error && <p className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">{error}</p>}

      {/* Current Plan - Detailed */}
      {subscription && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm text-gray-400 mb-2">Current Plan</p>
              <h2 className="text-3xl font-bold text-gray-100 capitalize">
                {PLAN_DETAILS[subscription.tier].name}
              </h2>
            </div>
            <div className="text-right">
              <div
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${
                  subscription.tier === 'free'
                    ? 'bg-gray-700/50 border-gray-600 text-gray-300'
                    : 'bg-green-900/30 border-green-700 text-green-400'
                }`}
              >
                {subscription.tier === 'free' ? '○ Free' : '✓ Active'}
              </div>
            </div>
          </div>

          {/* Limits & Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-gray-700">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Assets Limit</p>
              <p className="text-2xl font-bold text-gray-100">{subscription.limits.assets}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Users Limit</p>
              <p className="text-2xl font-bold text-gray-100">{subscription.limits.users}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Plan Type</p>
              <p className="text-lg font-semibold text-gray-100 capitalize">{subscription.plan}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Status</p>
              <p
                className={`text-lg font-semibold ${
                  subscription.tier === 'free'
                    ? 'text-gray-400'
                    : 'text-green-400'
                }`}
              >
                {subscription.tier === 'free' ? 'Forever' : 'Active'}
              </p>
            </div>
          </div>

          {/* Dates & Days Remaining */}
          {subscription.tier !== 'free' && subscription.subscriptionStartDate && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Subscription Started</span>
                <span className="text-sm font-medium text-gray-100">
                  {new Date(subscription.subscriptionStartDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Expires On</span>
                <span className="text-sm font-medium text-gray-100">
                  {subscription.subscriptionEndDate
                    ? new Date(subscription.subscriptionEndDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                <span className="text-sm text-gray-400">Time Remaining</span>
                <span className="text-sm font-bold text-green-400">
                  {(() => {
                    if (!subscription.subscriptionEndDate) return '—';
                    const now = new Date();
                    const end = new Date(subscription.subscriptionEndDate);
                    const diff = end.getTime() - now.getTime();
                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    if (days < 0) return 'Expired';
                    if (days === 0) return 'Expires Today';
                    if (days === 1) return '1 day left';
                    return `${days} days left`;
                  })()}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            {subscription.tier !== 'free' && userRole === 'super_admin' && (
              <button
                onClick={handleDowngrade}
                className="flex-1 px-4 py-2 text-sm bg-red-900/20 text-red-400 rounded-lg hover:bg-red-900/30 border border-red-800 font-medium transition-colors"
              >
                Downgrade to Free
              </button>
            )}
            {subscription.tier !== 'premium' && subscription.tier !== 'free' && userRole === 'super_admin' && (
              <button
                onClick={() => { setSelectedTier('premium'); setPlanType(subscription.plan as any); }}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Upgrade to Premium
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plan Type Toggle */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setPlanType('monthly')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            planType === 'monthly'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setPlanType('annual')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            planType === 'annual'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Annual (Save 17%)
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['free', 'pro', 'premium'] as const).map((tier) => {
          const plan = PLAN_DETAILS[tier];
          const isCurrent = subscription?.tier === tier;

          return (
            <div
              key={tier}
              className={`rounded-lg border p-6 relative ${
                isCurrent
                  ? 'border-gray-600 bg-gray-800 ring-2 ring-gray-600'
                  : 'border-gray-700 bg-gray-900/40 hover:border-gray-600 transition-colors'
              }`}
            >
              {isCurrent && (
                <div className="absolute top-4 right-4 px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full border border-green-800">
                  Current
                </div>
              )}

              <h3 className="text-xl font-bold text-gray-100 mb-2">{plan.name}</h3>

              <div className="mb-4">
                {tier === 'free' && (
                  <p className="text-3xl font-bold text-gray-100">₹0</p>
                )}
                {tier !== 'free' && (
                  <>
                    <p className="text-3xl font-bold text-gray-100">
                      {planType === 'monthly'
                        ? (tier === 'pro' ? '₹499' : '₹899')
                        : (tier === 'pro' ? '₹4,999' : '₹8,999')
                      }
                    </p>
                    <p className="text-sm text-gray-400">
                      {planType === 'monthly' ? 'per month' : 'per year'}
                    </p>
                  </>
                )}
              </div>

              <div className="mb-6 pb-6 border-b border-gray-700">
                <p className="text-sm font-medium text-gray-300 mb-2">
                  {plan.assets} Assets • {plan.users} Users
                </p>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {!isCurrent && tier !== 'free' && userRole === 'super_admin' && (
                <button
                  onClick={() => handleUpgrade(tier)}
                  disabled={upgrading === tier}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {upgrading === tier ? 'Processing...' : `Upgrade to ${plan.name}`}
                </button>
              )}

              {isCurrent && tier !== 'free' && (
                <button disabled className="w-full px-4 py-2 bg-gray-700 text-gray-300 rounded-lg font-medium cursor-default">
                  Current Plan
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-12 bg-gray-800/50 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Need help choosing?</h3>
        <p className="text-gray-400 mb-4">
          Start free and explore the basics.
          Upgrade when you need more assets, users and advanced features.
        </p>
        <Link href="/dashboard" className="text-blue-400">
          Go to Dashboard →
        </Link>
      </div>
    </div>
  );
}









