'use client';

import { useEffect, useState } from 'react';

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
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
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
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600'
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
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

  useEffect(() => {
    fetchKPIs();
  }, []);

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
        <span className="ml-3 text-gray-600">Loading KPIs...</span>
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error || 'No data available'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 KPIs & Metrics</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive insights into asset utilization, status, and performance
          </p>
        </div>
        <button
          onClick={fetchKPIs}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
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
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setView('detailed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'detailed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Asset Status Distribution</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(kpis.status).map(([status, data]) => (
                data.count > 0 && (
                  <div key={status} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-bold text-blue-600">
                        {data.count}
                      </span>
                    </div>
                    <ProgressBar percentage={data.percentage} color="bg-blue-600" />
                    <div className="flex justify-between mt-2 text-xs text-gray-600">
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
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Asset Utilization</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Assigned</span>
                    <span className="text-sm font-bold text-green-600">
                      {kpis.utilization.assigned.count} ({kpis.utilization.assigned.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar percentage={kpis.utilization.assigned.percentage} color="bg-green-600" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Unassigned</span>
                    <span className="text-sm font-bold text-gray-600">
                      {kpis.utilization.unassigned.count} ({kpis.utilization.unassigned.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar percentage={kpis.utilization.unassigned.percentage} color="bg-gray-400" />
                </div>
              </div>
            </div>

            {/* Warranty Status */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Warranty Status</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <span className="text-sm font-bold text-green-600">
                      {kpis.warranty.active.count} ({kpis.warranty.active.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar percentage={kpis.warranty.active.percentage} color="bg-green-600" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Expired</span>
                    <span className="text-sm font-bold text-red-600">
                      {kpis.warranty.expired.count} ({kpis.warranty.expired.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar percentage={kpis.warranty.expired.percentage} color="bg-red-600" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">No Warranty</span>
                    <span className="text-sm font-bold text-gray-600">
                      {kpis.warranty.none.count} ({kpis.warranty.none.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <ProgressBar percentage={kpis.warranty.none.percentage} color="bg-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Issue Metrics */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Issue Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{kpis.issues.open}</div>
                <div className="text-xs text-gray-600 mt-1">Open</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{kpis.issues.in_progress}</div>
                <div className="text-xs text-gray-600 mt-1">In Progress</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{kpis.issues.completed}</div>
                <div className="text-xs text-gray-600 mt-1">Completed</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{kpis.issues.cancelled}</div>
                <div className="text-xs text-gray-600 mt-1">Cancelled</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{kpis.issues.resolutionRate.toFixed(0)}%</div>
                <div className="text-xs text-gray-600 mt-1">Resolution Rate</div>
              </div>
            </div>
          </div>

          {/* Top Categories */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Asset Categories</h2>
            <div className="space-y-3">
              {kpis.categories.slice(0, 5).map((cat, idx) => (
                <div key={cat.name} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                      <span className="text-sm font-bold text-blue-600">{cat.count}</span>
                    </div>
                    <ProgressBar percentage={cat.percentage} color="bg-blue-600" />
                  </div>
                  <div className="text-sm text-gray-600">{formatCurrency(cat.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'detailed' && (
        <>
          {/* Condition Distribution */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Asset Condition Distribution</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(kpis.condition).map(([condition, count]) => (
                count > 0 && (
                  <div key={condition} className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{count}</div>
                    <div className="text-xs text-gray-600 mt-1 capitalize">{condition.replace(/_/g, ' ')}</div>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Age Distribution */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Asset Age Distribution</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {kpis.ageDistribution.map((age) => (
                <div key={age.range} className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-xl font-bold text-gray-900">{age.count}</div>
                  <div className="text-xs text-gray-600 mt-1">{age.range}</div>
                  <div className="text-xs text-blue-600 mt-1">{age.percentage.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Location & Department Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Locations */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Locations</h2>
              <div className="space-y-3">
                {kpis.locations.slice(0, 5).map((loc) => (
                  <div key={loc.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{loc.name}</span>
                      <span className="text-sm font-bold text-blue-600">{loc.count}</span>
                    </div>
                    <ProgressBar percentage={loc.percentage} color="bg-blue-600" />
                  </div>
                ))}
              </div>
            </div>

            {/* Departments */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h2>
              <div className="space-y-3">
                {kpis.departments.slice(0, 5).map((dept) => (
                  <div key={dept.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{dept.name}</span>
                      <span className="text-sm font-bold text-purple-600">{dept.count}</span>
                    </div>
                    <ProgressBar percentage={dept.percentage} color="bg-purple-600" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

