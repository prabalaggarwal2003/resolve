'use client';

import { useEffect, useState } from 'react';

interface HealthSummary {
  total: number;
  excellent: number;
  good: number;
  fair: number;
  poor: number;
  critical: number;
  under_maintenance: number;
}

interface HealthThresholds {
  AGE_CRITICAL_YEARS: number;
  AGE_MAINTENANCE_YEARS: number;
  OPEN_ISSUES_WARNING: number;
  OPEN_ISSUES_CRITICAL: number;
  OPEN_ISSUES_MAINTENANCE: number;
  WARRANTY_EXPIRY_DAYS: number;
}

const CONDITION_COLORS = {
  excellent: 'bg-green-100 text-green-800 border-green-200',
  good: 'bg-blue-100 text-blue-800 border-blue-200',
  fair: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  poor: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
  under_maintenance: 'bg-gray-100 text-gray-800 border-gray-200'
};

const CONDITION_ICONS = {
  excellent: '✨',
  good: '✅',
  fair: '⚠️',
  poor: '🔶',
  critical: '🚨',
  under_maintenance: '🔧'
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function AssetHealthPage() {
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [thresholds, setThresholds] = useState<HealthThresholds | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runningCheck, setRunningCheck] = useState(false);

  const fetchHealthSummary = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      const res = await fetch(api('/api/asset-health/summary'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSummary(data.summary);
        setThresholds(data.thresholds);
      } else {
        setError(data.message || 'Failed to load health summary');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const runHealthCheck = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    setRunningCheck(true);
    try {
      const res = await fetch(api('/api/asset-health/check-all'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const results = await res.json();
      if (res.ok) {
        alert(`Health check complete!\nUpdated: ${results.updated} assets\nMaintenance: ${results.maintenance} assets\nCritical: ${results.critical} assets`);
        await fetchHealthSummary(); // Refresh data
      } else {
        setError(results.message || 'Failed to run health check');
      }
    } catch (err) {
      setError('Network error during health check');
    } finally {
      setRunningCheck(false);
    }
  };

  useEffect(() => {
    fetchHealthSummary();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Health Monitor</h1>
          <p className="text-gray-600 mt-1">
            Monitor asset conditions and automate maintenance scheduling
          </p>
        </div>
        <button
          onClick={runHealthCheck}
          disabled={runningCheck}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {runningCheck ? (
            <>
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Running Check...
            </>
          ) : (
            '🔍 Run Health Check'
          )}
        </button>
      </div>

      {/* Health Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Assets</p>
              <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
            </div>
          </div>

          {Object.entries(summary).filter(([key]) => key !== 'total').map(([condition, count]) => (
            <div
              key={condition}
              className={`p-4 rounded-lg border ${CONDITION_COLORS[condition as keyof typeof CONDITION_COLORS]}`}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">{CONDITION_ICONS[condition as keyof typeof CONDITION_ICONS]}</div>
                <p className="text-sm font-medium capitalize mb-1">{condition.replace('_', ' ')}</p>
                <p className="text-xl font-bold">{count}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Health Thresholds */}
      {thresholds && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Health Check Thresholds</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Age Thresholds</h3>
              <p className="text-sm text-gray-600">Critical: {thresholds.AGE_CRITICAL_YEARS} years</p>
              <p className="text-sm text-gray-600">Maintenance: {thresholds.AGE_MAINTENANCE_YEARS} years</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Open Issues</h3>
              <p className="text-sm text-gray-600">Warning: {thresholds.OPEN_ISSUES_WARNING} issues</p>
              <p className="text-sm text-gray-600">Critical: {thresholds.OPEN_ISSUES_CRITICAL} issues</p>
              <p className="text-sm text-gray-600">Maintenance: {thresholds.OPEN_ISSUES_MAINTENANCE} issues</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Warranty Alert</h3>
              <p className="text-sm text-gray-600">Expiry warning: {thresholds.WARRANTY_EXPIRY_DAYS} days</p>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Automated Actions</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
            <span className="text-xl">🔧</span>
            <div>
              <p className="font-medium text-gray-900">Automatic Maintenance Mode</p>
              <p className="text-sm text-gray-600">
                Assets automatically enter maintenance when they exceed age or issue thresholds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
            <span className="text-xl">🚫</span>
            <div>
              <p className="font-medium text-gray-900">Issue Reporting Blocked</p>
              <p className="text-sm text-gray-600">
                Users cannot report issues for assets under maintenance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <span className="text-xl">📊</span>
            <div>
              <p className="font-medium text-gray-900">Health Monitoring</p>
              <p className="text-sm text-gray-600">
                Continuous monitoring of asset age, issues, and warranty status
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
