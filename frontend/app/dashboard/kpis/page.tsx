'use client';

import { useEffect, useState } from 'react';
import { UpgradePrompt } from '@/lib/subscriptionUtils';

interface KPIData {
  overview: {
    totalAssets: number;
    totalValue: number;
    averageValue: number;
    maxValue: number;
    minValue: number;
  };
  status: {
    [key: string]: {
      count: number;
      value: number;
      percentage: number;
    };
  };
  utilization: {
    assigned: { count: number; percentage: number };
    unassigned: { count: number; percentage: number };
    utilizationRate: number;
  };
  warranty: {
    active: { count: number; percentage: number };
    expired: { count: number; percentage: number };
    none: { count: number; percentage: number };
  };
  condition: { [key: string]: number };
  issues: {
    open: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    total: number;
    openPercentage: number;
    resolutionRate: number;
  };
  categories: Array<{ name: string; count: number; value: number; percentage: number }>;
  ageDistribution: Array<{ range: string; count: number; percentage: number }>;
  locations: Array<{ name: string; count: number; percentage: number }>;
  departments: Array<{ name: string; count: number; percentage: number }>;
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div className="w-full bg-gray-700 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      ></div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, color = 'blue' }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-900/20 text-blue-400',
    green: 'bg-green-900/20 text-green-400',
    red: 'bg-red-900/20 text-red-400',
    yellow: 'bg-yellow-900/20 text-yellow-400',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-900 text-gray-400'
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-100">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

export default function KPIPage() {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'overview' | 'detailed'>('overview');
  const [tier, setTier] = useState<string>('free');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    fetchSubscription();
    fetchKPIs();
  }, []);

  const fetchSubscription = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      const res = await fetch(api('/api/payments/subscription-status'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTier(data.tier);
        setIsExpired(data.isExpired || false);
      }
    } catch (_) { }
  };

  const fetchKPIs = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setError('Not authenticated');
      return;
    }

    try {
      const res = await fetch(api('/api/kpis'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setKpis(data);
      } else {
        setError(data.message || 'Failed to load KPIs');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-400">Loading KPIs...</span>
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-400">{error || 'No data available'}</p>
      </div>
    );
  }

  if (tier === 'free' || isExpired) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-100 mb-6">📊 KPIs & Metrics</h1>
        {isExpired && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-medium">⚠️ Your subscription has expired</p>
            <p className="text-red-300 text-sm mt-1">Renew your subscription to access KPIs & Metrics</p>
          </div>
        )}
        <UpgradePrompt feature={isExpired ? 'KPIs & Metrics (Renew subscription to unlock)' : 'KPIs & Metrics Dashboard'} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">KPIs & Metrics</h1>
          <p className="text-gray-400 mt-1">
            Comprehensive insights into asset utilization, status and performance.
          </p>
        </div>
        <button
          onClick={fetchKPIs}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
        >
          🔄 Refresh
        </button>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('overview')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'overview'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setView('detailed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'detailed'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Detailed Analytics
        </button>
      </div>

      {view === 'overview' && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Assets"
              value={kpis.overview.totalAssets}
              subtitle={`Avg value: ${formatCurrency(kpis.overview.averageValue)}`}
              icon="📦"
              color="blue"
            />
            <StatCard
              title="Total Value"
              value={formatCurrency(kpis.overview.totalValue)}
              subtitle={`Max: ${formatCurrency(kpis.overview.maxValue)}`}
              icon="💰"
              color="green"
            />
            <StatCard
              title="Utilization Rate"
              value={`${kpis.utilization.utilizationRate.toFixed(1)}%`}
              subtitle={`${kpis.utilization.assigned.count} assigned`}
              icon="📈"
              color="purple"
            />
            <StatCard
              title="Open Issues"
              value={kpis.issues.open}
              subtitle={`${kpis.issues.openPercentage.toFixed(1)}% of total`}
              icon="🔴"
              color="red"
            />
          </div>

          {/* Status Distribution */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Asset Status Distribution</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(kpis.status).map(([status, data]) => (
                data.count > 0 && (
                  <div key={status} className="p-4 bg-gray-900 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-100 capitalize">
                        {status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-bold text-blue-400">
                        {data.count}
                      </span>
                    </div>
                    <ProgressBar percentage={data.percentage} color="bg-gray-700" />
                    <div className="flex justify-between mt-2 text-xs text-gray-400">
                      <span>{data.percentage.toFixed(1)}%</span>
                      <span>{formatCurrency(data.value)}</span>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Utilization & Warranty */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Utilization */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Asset Utilization</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">Assigned</span>
                    <span className="text-sm font-bold text-green-400">
                      {kpis.utilization.assigned.count} ({kpis.utilization.assigned.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar percentage={kpis.utilization.assigned.percentage} color="bg-green-600" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">Unassigned</span>
                    <span className="text-sm font-bold text-gray-400">
                      {kpis.utilization.unassigned.count} ({kpis.utilization.unassigned.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar percentage={kpis.utilization.unassigned.percentage} color="bg-gray-400" />
                </div>
              </div>
            </div>

            {/* Warranty Status */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Warranty Status</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">Active</span>
                    <span className="text-sm font-bold text-green-400">
                      {kpis.warranty.active.count} ({kpis.warranty.active.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar percentage={kpis.warranty.active.percentage} color="bg-green-600" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">Expired</span>
                    <span className="text-sm font-bold text-red-400">
                      {kpis.warranty.expired.count} ({kpis.warranty.expired.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar percentage={kpis.warranty.expired.percentage} color="bg-red-600" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">No Warranty</span>
                    <span className="text-sm font-bold text-gray-400">
                      {kpis.warranty.none.count} ({kpis.warranty.none.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar percentage={kpis.warranty.none.percentage} color="bg-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Issue Metrics */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Issue Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-400">{kpis.issues.open}</div>
                <div className="text-xs text-gray-400 mt-1">Open</div>
              </div>
              <div className="text-center p-4 bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">{kpis.issues.in_progress}</div>
                <div className="text-xs text-gray-400 mt-1">In Progress</div>
              </div>
              <div className="text-center p-4 bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{kpis.issues.completed}</div>
                <div className="text-xs text-gray-400 mt-1">Completed</div>
              </div>
              <div className="text-center p-4 bg-gray-900 rounded-lg">
                <div className="text-2xl font-bold text-gray-400">{kpis.issues.cancelled}</div>
                <div className="text-xs text-gray-400 mt-1">Cancelled</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{kpis.issues.resolutionRate.toFixed(0)}%</div>
                <div className="text-xs text-gray-400 mt-1">Resolution Rate</div>
              </div>
            </div>
          </div>

          {/* Top Categories */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Top Asset Categories</h2>
            <div className="space-y-3">
              {kpis.categories.slice(0, 5).map((cat, idx) => (
                <div key={cat.name} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-400 flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-100">{cat.name}</span>
                      <span className="text-sm font-bold text-blue-400">{cat.count}</span>
                    </div>
                    <ProgressBar percentage={cat.percentage} color="bg-gray-700" />
                  </div>
                  <div className="text-sm text-gray-400">{formatCurrency(cat.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'detailed' && (
        <>
          {/* Risk & Health Assessment */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Asset Health Risk */}
            <div className="bg-gradient-to-br from-red-900/30 to-red-900/10 border border-red-700/60 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-red-300">🚨 At-Risk Assets</h2>
                <span className="text-3xl font-bold text-red-400">{Math.max(kpis.issues.open, kpis.warranty.expired.count)}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-red-300">
                  <span>Open Issues requiring attention:</span>
                  <span className="font-bold">{kpis.issues.open}</span>
                </div>
                <div className="flex justify-between text-red-300">
                  <span>Expired warranties:</span>
                  <span className="font-bold">{kpis.warranty.expired.count}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-red-700/40">
                  <p className="text-xs text-red-400">⚠️ Immediate action recommended for {Math.max(kpis.issues.open, kpis.warranty.expired.count)} assets</p>
                </div>
              </div>
            </div>

            {/* Maintenance Cost Impact */}
            <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-900/10 border border-yellow-700/60 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-yellow-300">📈 Maintenance Pressure</h2>
                <span className="text-3xl font-bold text-yellow-400">{kpis.issues.in_progress}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-yellow-300">
                  <span>Currently in maintenance:</span>
                  <span className="font-bold">{kpis.issues.in_progress}</span>
                </div>
                <div className="flex justify-between text-yellow-300">
                  <span>Completion rate:</span>
                  <span className="font-bold">{kpis.issues.resolutionRate.toFixed(0)}%</span>
                </div>
                <div className="mt-3 pt-3 border-t border-yellow-700/40">
                  <p className="text-xs text-yellow-400">Estimated impact on operations</p>
                </div>
              </div>
            </div>

            {/* Asset Optimization Score */}
            <div className="bg-gradient-to-br from-green-900/30 to-green-900/10 border border-green-700/60 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-green-300">✅ Optimization Score</h2>
                <span className="text-3xl font-bold text-green-400">{(kpis.utilization.utilizationRate + kpis.issues.resolutionRate) / 2 > 70 ? 'A' : 'B'}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-green-300">
                  <span>Utilization efficiency:</span>
                  <span className="font-bold">{kpis.utilization.utilizationRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-green-300">
                  <span>Issue resolution rate:</span>
                  <span className="font-bold">{kpis.issues.resolutionRate.toFixed(1)}%</span>
                </div>
                <div className="mt-3 pt-3 border-t border-green-700/40">
                  <p className="text-xs text-green-400">📊 Pro tip: Track these metrics weekly</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cost Analysis & ROI */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">💼 Cost & ROI Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">Total Asset Value</p>
                <p className="text-2xl font-bold text-blue-400">{formatCurrency(kpis.overview.totalValue)}</p>
                <div className="mt-3 text-xs text-gray-500">Portfolio value</div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">Average Asset Cost</p>
                <p className="text-2xl font-bold text-purple-400">{formatCurrency(kpis.overview.averageValue)}</p>
                <div className="mt-3 text-xs text-gray-500">Per asset investment</div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">Cost Per Active Asset</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(kpis.utilization.assigned.count > 0 ? kpis.overview.totalValue / kpis.utilization.assigned.count : 0)}
                </p>
                <div className="mt-3 text-xs text-gray-500">Utilization cost</div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">At-Risk Value</p>
                <p className="text-2xl font-bold text-red-400">
                  {formatCurrency((kpis.overview.totalValue / kpis.overview.totalAssets) * Math.max(kpis.issues.open, kpis.warranty.expired.count))}
                </p>
                <div className="mt-3 text-xs text-gray-500">Requires attention</div>
              </div>
            </div>
          </div>

          {/* Condition Distribution with Insights */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">🔍 Asset Condition Breakdown</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(kpis.condition).map(([condition, count]) => (
                count > 0 && (
                  <div key={condition} className="text-center p-4 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                    <div className="text-3xl font-bold text-gray-100">{count}</div>
                    <div className="text-xs text-gray-400 mt-1 capitalize font-medium">{condition.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-blue-400 mt-2">
                      {((count / kpis.overview.totalAssets) * 100).toFixed(1)}%
                    </div>
                  </div>
                )
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg">
              <p className="text-xs text-blue-300">💡 Monitor condition trends to prevent failures and reduce unexpected maintenance costs</p>
            </div>
          </div>

          {/* Age Distribution with Risk Assessment */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">📅 Asset Age & Depreciation Timeline</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {kpis.ageDistribution.map((age, idx) => (
                <div key={age.range} className="p-4 bg-gray-900 rounded-lg border border-gray-700">
                  <div className="text-2xl font-bold text-gray-100">{age.count}</div>
                  <div className="text-xs text-gray-400 mt-1 font-medium">{age.range}</div>
                  <div className="text-xs text-blue-400 mt-2 font-bold">{age.percentage.toFixed(1)}%</div>
                  <div className="mt-2 text-xs text-gray-500">
                    {idx >= 3 ? '⚠️ High depreciation' : idx >= 2 ? '🟡 Moderate age' : '✅ Good condition'}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg">
              <p className="text-xs text-yellow-300">📊 Older assets (3+ years) require more frequent maintenance and have higher failure rates</p>
            </div>
          </div>

          {/* Performance by Location & Department */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Locations Performance */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">📍 Location Performance</h2>
              <div className="space-y-3">
                {kpis.locations.slice(0, 8).map((loc, idx) => (
                  <div key={loc.name} className="p-3 bg-gray-900 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-blue-400 w-6">{idx + 1}</span>
                        <span className="text-sm font-medium text-gray-100">{loc.name}</span>
                      </div>
                      <span className="text-sm font-bold text-blue-400">{loc.count} assets</span>
                    </div>
                    <ProgressBar percentage={loc.percentage} color="bg-blue-600" />
                    <div className="text-xs text-gray-500 mt-1">{loc.percentage.toFixed(1)}% of total</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg">
                <p className="text-xs text-blue-300">🎯 Allocate maintenance resources based on asset density</p>
              </div>
            </div>

            {/* Department Performance */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">👥 Department Asset Distribution</h2>
              <div className="space-y-3">
                {kpis.departments.slice(0, 8).map((dept, idx) => (
                  <div key={dept.name} className="p-3 bg-gray-900 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-purple-400 w-6">{idx + 1}</span>
                        <span className="text-sm font-medium text-gray-100">{dept.name}</span>
                      </div>
                      <span className="text-sm font-bold text-purple-400">{dept.count} assets</span>
                    </div>
                    <ProgressBar percentage={dept.percentage} color="bg-purple-600" />
                    <div className="text-xs text-gray-500 mt-1">{dept.percentage.toFixed(1)}% of total</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-purple-900/20 border border-purple-700/40 rounded-lg">
                <p className="text-xs text-purple-300">📈 Track departmental asset usage for budget planning</p>
              </div>
            </div>
          </div>

          {/* Issue Analytics */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">🔧 Issue & Maintenance Analytics</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-lg">
                <div className="text-2xl font-bold text-yellow-400">{kpis.issues.open}</div>
                <div className="text-xs text-gray-400 mt-2 font-medium">Open Issues</div>
                <div className="text-xs text-yellow-400 mt-1">{kpis.issues.openPercentage.toFixed(1)}% pending</div>
              </div>
              <div className="p-4 bg-blue-900/20 border border-blue-700/40 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">{kpis.issues.in_progress}</div>
                <div className="text-xs text-gray-400 mt-2 font-medium">In Progress</div>
                <div className="text-xs text-blue-400 mt-1">Being resolved</div>
              </div>
              <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{kpis.issues.completed}</div>
                <div className="text-xs text-gray-400 mt-2 font-medium">Resolved</div>
                <div className="text-xs text-green-400 mt-1">{((kpis.issues.completed / kpis.issues.total) * 100).toFixed(0)}% success</div>
              </div>
              <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
                <div className="text-2xl font-bold text-gray-400">{kpis.issues.cancelled}</div>
                <div className="text-xs text-gray-400 mt-2 font-medium">Cancelled</div>
                <div className="text-xs text-gray-500 mt-1">Not applicable</div>
              </div>
              <div className="p-4 bg-purple-900/20 border border-purple-700/40 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">{kpis.issues.resolutionRate.toFixed(0)}%</div>
                <div className="text-xs text-gray-400 mt-2 font-medium">Resolution Rate</div>
                <div className="text-xs text-purple-400 mt-1">Efficiency metric</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-green-900/20 border border-green-700/40 rounded-lg">
              <p className="text-xs text-green-300">✅ A resolution rate above 80% indicates efficient asset management</p>
            </div>
          </div>

          {/* Top Asset Categories - Extended */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">📦 Asset Category Deep Dive</h2>
            <div className="space-y-4">
              {kpis.categories.slice(0, 10).map((cat, idx) => (
                <div key={cat.name} className="p-4 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center font-bold text-sm text-white">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-100">{cat.name}</p>
                        <p className="text-xs text-gray-500">Total value: {formatCurrency(cat.value)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-400">{cat.count}</p>
                      <p className="text-xs text-gray-400">{cat.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <ProgressBar percentage={cat.percentage} color="bg-blue-600" />
                  <div className="mt-2 flex justify-between text-xs text-gray-500">
                    <span>Avg per unit: {formatCurrency(cat.value / cat.count)}</span>
                    <span>Investment: {((cat.value / kpis.overview.totalValue) * 100).toFixed(1)}% of portfolio</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg">
              <p className="text-xs text-blue-300">💡 Focus maintenance efforts on high-value categories to minimize operational risk</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

