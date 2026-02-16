'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface MaintenanceAsset {
  _id: string;
  assetId: string;
  name: string;
  category: string;
  model?: string;
  serialNumber?: string;
  status: string;
  condition: string;
  maintenanceReason?: string;
  maintenanceStartDate?: string;
  daysUnderMaintenance: number;
  isOverdue: boolean;
  locationId?: { name: string; path?: string };
  departmentId?: { name: string };
  assignedTo?: { name: string; email: string };
  purchaseDate?: string;
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString();
}

function AssetCard({ asset, onCompleteMaintenance }: {
  asset: MaintenanceAsset;
  onCompleteMaintenance: (assetId: string) => void;
}) {
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    await onCompleteMaintenance(asset._id);
    setCompleting(false);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border p-5 ${
      asset.isOverdue 
        ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' 
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{asset.name}</h3>
            {asset.isOverdue && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 text-xs rounded-full font-medium">
                ⚠️ Overdue
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{asset.assetId} · {asset.category}</p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${
            asset.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
          }`}>
            {asset.daysUnderMaintenance} days
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500">under maintenance</p>
        </div>
      </div>

      {/* Maintenance Reason */}
      {asset.maintenanceReason && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">Reason:</span> {asset.maintenanceReason}
          </p>
        </div>
      )}

      {/* Asset Details */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        {asset.model && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Model:</span>{' '}
            <span className="text-gray-900 dark:text-gray-100">{asset.model}</span>
          </div>
        )}
        {asset.serialNumber && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Serial:</span>{' '}
            <span className="text-gray-900 dark:text-gray-100">{asset.serialNumber}</span>
          </div>
        )}
        {asset.locationId && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Location:</span>{' '}
            <span className="text-gray-900 dark:text-gray-100">{asset.locationId.path || asset.locationId.name}</span>
          </div>
        )}
        {asset.departmentId && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Department:</span>{' '}
            <span className="text-gray-900 dark:text-gray-100">{asset.departmentId.name}</span>
          </div>
        )}
        {asset.assignedTo && (
          <div>
            <span className="text-gray-500 dark:text-gray-400">Assigned to:</span>{' '}
            <span className="text-gray-900 dark:text-gray-100">{asset.assignedTo.name}</span>
          </div>
        )}
        <div>
          <span className="text-gray-500 dark:text-gray-400">Started:</span>{' '}
          <span className="text-gray-900 dark:text-gray-100">{formatDate(asset.maintenanceStartDate)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href={`/dashboard/assets/${asset._id}`}
          className="flex-1 text-center py-2 px-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          View Details
        </Link>
        <button
          onClick={handleComplete}
          disabled={completing}
          className="flex-1 py-2 px-3 bg-green-600 dark:bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-700 dark:hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {completing ? 'Completing...' : '✓ Complete Maintenance'}
        </button>
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const [assets, setAssets] = useState<MaintenanceAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');

  const fetchAssets = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }

    try {
      const res = await fetch(api('/api/asset-health/maintenance'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAssets(data.assets || []);
      } else {
        setError(data.message || 'Failed to load maintenance assets');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const completeMaintenance = async (assetId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      const res = await fetch(api(`/api/asset-health/${assetId}/maintenance`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'complete' })
      });

      if (res.ok) {
        // Remove from list
        setAssets(prev => prev.filter(a => a._id !== assetId));
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to complete maintenance');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const filteredAssets = filter === 'overdue'
    ? assets.filter(a => a.isOverdue)
    : assets;

  const overdueCount = assets.filter(a => a.isOverdue).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading maintenance assets...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🔧 Maintenance</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Assets currently under maintenance and requiring attention
          </p>
        </div>
        <Link
          href="/dashboard/asset-health"
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
        >
          View Health Dashboard →
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🔧</div>
            <div>
              <p className="text-sm text-amber-600 dark:text-amber-400">Under Maintenance</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">{assets.length}</p>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${
          overdueCount > 0 
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' 
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">{overdueCount > 0 ? '⚠️' : '✅'}</div>
            <div>
              <p className={`text-sm ${overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                Overdue (&gt;2 days)
              </p>
              <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-900 dark:text-red-200' : 'text-green-900 dark:text-green-200'}`}>
                {overdueCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400">On Track</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{assets.length - overdueCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-gray-900 dark:bg-gray-700 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          All ({assets.length})
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'overdue'
              ? 'bg-red-600 dark:bg-red-500 text-white'
              : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/40'
          }`}
        >
          Overdue ({overdueCount})
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {filteredAssets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {filter === 'overdue'
              ? 'No overdue maintenance'
              : 'No assets under maintenance'
            }
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {filter === 'overdue'
              ? 'All maintenance tasks are on track.'
              : 'All assets are in working condition.'
            }
          </p>
        </div>
      ) : (
        /* Asset Cards Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredAssets.map(asset => (
            <AssetCard
              key={asset._id}
              asset={asset}
              onCompleteMaintenance={completeMaintenance}
            />
          ))}
        </div>
      )}
    </div>
  );
}
