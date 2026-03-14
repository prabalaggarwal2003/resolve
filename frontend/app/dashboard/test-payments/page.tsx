'use client';

import { useEffect, useState } from 'react';

interface TestPaymentState {
  tier: string;
  plan: string;
  startDate: string | null;
  endDate: string | null;
  isExpired: boolean;
  daysRemaining: number | null;
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function TestPaymentsPage() {
  const [state, setState] = useState<TestPaymentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedTier, setSelectedTier] = useState<'pro' | 'premium'>('pro');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Not authenticated');
      return;
    }

    try {
      const res = await fetch(api('/api/test-payments/current-subscription'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setState(data);
      } else {
        setError(data.message || 'Failed to fetch subscription');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const runTest = async (scenario: 'success' | 'failure' | 'expire' | 'renew') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setTesting(scenario);
    setError('');

    try {
      const res = await fetch(api('/api/test-payments/simulate-payment'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scenario,
          tier: selectedTier,
          planType: selectedPlan,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || `Test failed: ${scenario}`);
      } else {
        alert(`✅ ${scenario.toUpperCase()} test executed\n\n${data.message}`);
        fetchSubscription();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(null);
    }
  };

  const resetSubscription = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!confirm('Reset subscription to free? This will erase current subscription.')) return;

    try {
      const res = await fetch(api('/api/test-payments/reset'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        alert('✅ Subscription reset to free');
        fetchSubscription();
      } else {
        setError(data.message || 'Reset failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    }
  };

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-100 mb-2">🧪 Payment Testing Suite</h1>
      <p className="text-gray-400 mb-6">
        Test different payment scenarios in development
      </p>

      {/* Current Subscription Status */}
      {state && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Current Subscription</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-400">Tier</p>
              <p className="text-lg font-bold text-gray-100 capitalize">{state.tier}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Plan</p>
              <p className="text-lg font-bold text-gray-100 capitalize">{state.plan}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Status</p>
              <p className={`text-lg font-bold ${state.isExpired ? 'text-red-400' : 'text-green-400'}`}>
                {state.isExpired ? 'Expired' : 'Active'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Days Remaining</p>
              <p className="text-lg font-bold text-gray-100">
                {state.daysRemaining ?? '—'}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            <p>Start: {state.startDate ? new Date(state.startDate).toLocaleString() : '—'}</p>
            <p>End: {state.endDate ? new Date(state.endDate).toLocaleString() : '—'}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Test Configuration */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Test Configuration</h2>
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Tier</label>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value as 'pro' | 'premium')}
              className="px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg"
            >
              <option value="pro">Pro (₹499/mo or ₹4,999/yr)</option>
              <option value="premium">Premium (₹899/mo or ₹8,999/yr)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Plan</label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value as 'monthly' | 'annual')}
              className="px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg"
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-100">Scenarios</h3>

          <button
            onClick={() => runTest('success')}
            disabled={testing === 'success'}
            className="w-full px-4 py-3 bg-green-900/30 border border-green-800 text-green-400 rounded-lg hover:bg-green-900/50 disabled:opacity-50 font-medium transition-colors"
          >
            {testing === 'success' ? '⏳ Testing...' : '✅ Test: Payment Success'}
          </button>

          <button
            onClick={() => runTest('failure')}
            disabled={testing === 'failure'}
            className="w-full px-4 py-3 bg-red-900/30 border border-red-800 text-red-400 rounded-lg hover:bg-red-900/50 disabled:opacity-50 font-medium transition-colors"
          >
            {testing === 'failure' ? '⏳ Testing...' : '❌ Test: Payment Failure'}
          </button>

          <button
            onClick={() => runTest('expire')}
            disabled={testing === 'expire' || state?.tier === 'free'}
            className="w-full px-4 py-3 bg-yellow-900/30 border border-yellow-800 text-yellow-400 rounded-lg hover:bg-yellow-900/50 disabled:opacity-50 font-medium transition-colors"
          >
            {testing === 'expire' ? '⏳ Testing...' : '⏰ Test: Subscription Expires'}
          </button>

          <button
            onClick={() => runTest('renew')}
            disabled={testing === 'renew' || state?.tier === 'free'}
            className="w-full px-4 py-3 bg-blue-900/30 border border-blue-800 text-blue-400 rounded-lg hover:bg-blue-900/50 disabled:opacity-50 font-medium transition-colors"
          >
            {testing === 'renew' ? '⏳ Testing...' : '🔄 Test: Subscription Renewal'}
          </button>

          <button
            onClick={resetSubscription}
            className="w-full px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 font-medium transition-colors"
          >
            🔄 Reset to Free Tier
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
        <h3 className="font-semibold text-gray-100 mb-4">How to Test</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>
            <strong className="text-gray-300">✅ Success:</strong> Upgrades subscription immediately, sets expiry based on plan type
          </li>
          <li>
            <strong className="text-gray-300">❌ Failure:</strong> Simulates payment decline, no subscription changes
          </li>
          <li>
            <strong className="text-gray-300">⏰ Expires:</strong> Sets subscription end date to 1 day ago to test expired state
          </li>
          <li>
            <strong className="text-gray-300">🔄 Renewal:</strong> Extends subscription by 1 month/year based on current plan
          </li>
          <li>
            <strong className="text-gray-300">🔄 Reset:</strong> Returns subscription to free tier for clean testing
          </li>
        </ul>
        <p className="mt-4 text-xs text-gray-500">
          This page is only available in development. Remove access before deploying to production.
        </p>
      </div>
    </div>
  );
}

