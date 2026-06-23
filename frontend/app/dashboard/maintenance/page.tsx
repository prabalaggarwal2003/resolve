'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

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
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const OVERDUE_MS = 2 * 24 * 60 * 60 * 1000;

function SummaryCard({
  label,
  value,
  hint,
  accent = 'text-gray-100',
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 tabular-nums ${accent}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function useIsOverdue(startDate: string | undefined): boolean {
  const calc = () =>
    startDate ? Date.now() - new Date(startDate).getTime() > OVERDUE_MS : false;

  const [overdue, setOverdue] = useState(calc);

  useEffect(() => {
    setOverdue(calc());
    const id = setInterval(() => setOverdue(calc()), 30_000);
    return () => clearInterval(id);
  }, [startDate]);

  return overdue;
}

function useElapsed(startDate: string | undefined) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startDate) {
      setElapsed('—');
      return;
    }
    const calc = () => {
      const diff = Math.max(0, Date.now() - new Date(startDate).getTime());
      const totalSeconds = Math.floor(diff / 1000);
      const d = Math.floor(totalSeconds / 86400);
      const h = Math.floor((totalSeconds % 86400) / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      const parts: string[] = [];
      if (d > 0) parts.push(`${d}d`);
      parts.push(`${String(h).padStart(2, '0')}h`);
      parts.push(`${String(m).padStart(2, '0')}m`);
      parts.push(`${String(s).padStart(2, '0')}s`);
      setElapsed(parts.join(' '));
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [startDate]);

  return elapsed;
}

function DetailTile({
  label,
  value,
  overdue = false,
}: {
  label: string;
  value: string;
  overdue?: boolean;
}) {
  return (
    <div
      className={`px-2 py-1.5 rounded-lg border min-w-0 ${
        overdue
          ? 'border-red-500/25 bg-red-950/30'
          : 'border-gray-700/40 bg-gray-900/30'
      }`}
    >
      <p className={`text-[10px] uppercase tracking-wide ${overdue ? 'text-red-400/70' : 'text-gray-500'}`}>
        {label}
      </p>
      <p className={`text-xs font-medium mt-0.5 truncate ${overdue ? 'text-red-100' : 'text-gray-200'}`}>
        {value}
      </p>
    </div>
  );
}

function AssetCard({
  asset,
  onCompleteMaintenance,
}: {
  asset: MaintenanceAsset;
  onCompleteMaintenance: (assetId: string) => void;
}) {
  const [completing, setCompleting] = useState(false);
  const elapsed = useElapsed(asset.maintenanceStartDate);
  const isOverdue = useIsOverdue(asset.maintenanceStartDate);

  const handleComplete = async () => {
    setCompleting(true);
    await onCompleteMaintenance(asset._id);
    setCompleting(false);
  };

  return (
    <div
      className={`rounded-xl px-4 py-4 border-l-4 ${
        isOverdue
          ? 'border border-red-500/50 border-l-red-500 bg-gradient-to-r from-red-950/55 via-red-950/30 to-gray-900/50 ring-1 ring-red-500/20 shadow-[inset_0_1px_0_0_rgba(248,113,113,0.08)]'
          : 'border border-gray-700/60 border-l-amber-500/50 bg-gray-800/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-sm font-semibold truncate ${isOverdue ? 'text-red-50' : 'text-gray-100'}`}>
              {asset.name}
            </h3>
            {isOverdue && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded border text-red-100 bg-red-600/30 border-red-400/50">
                Overdue
              </span>
            )}
          </div>
          <p className={`text-[11px] mt-0.5 ${isOverdue ? 'text-red-300/70' : 'text-gray-500'}`}>
            {asset.assetId} · {asset.category}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold font-mono tabular-nums ${isOverdue ? 'text-red-400' : 'text-amber-300'}`}>
            {elapsed}
          </p>
          <p className={`text-[10px] uppercase tracking-wide ${isOverdue ? 'text-red-400/80' : 'text-gray-500'}`}>
            elapsed
          </p>
        </div>
      </div>

      {asset.maintenanceReason && (
        <div
          className={`mb-3 px-2 py-1.5 rounded-lg border ${
            isOverdue
              ? 'border-red-500/30 bg-red-950/40'
              : 'border-amber-500/20 bg-amber-500/5'
          }`}
        >
          <p
            className={`text-[10px] uppercase tracking-wide mb-0.5 ${
              isOverdue ? 'text-red-400' : 'text-amber-400/80'
            }`}
          >
            Reason
          </p>
          <p className={`text-xs ${isOverdue ? 'text-red-100/90' : 'text-amber-100/90'}`}>
            {asset.maintenanceReason}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        {asset.model && <DetailTile label="Model" value={asset.model} overdue={isOverdue} />}
        {asset.serialNumber && <DetailTile label="Serial" value={asset.serialNumber} overdue={isOverdue} />}
        {asset.locationId && (
          <DetailTile
            label="Location"
            value={asset.locationId.path || asset.locationId.name}
            overdue={isOverdue}
          />
        )}
        {asset.departmentId && (
          <DetailTile label="Department" value={asset.departmentId.name} overdue={isOverdue} />
        )}
        {asset.assignedTo && (
          <DetailTile label="Assigned to" value={asset.assignedTo.name} overdue={isOverdue} />
        )}
        <DetailTile label="Started" value={formatDate(asset.maintenanceStartDate)} overdue={isOverdue} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/dashboard/assets/${asset._id}`}
          className="flex-1 min-w-[120px] text-center px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 bg-gray-800/40 text-gray-300 hover:bg-gray-700/60 hover:text-gray-100 transition-colors"
        >
          View asset
        </Link>
        <button
          onClick={handleComplete}
          disabled={completing}
          className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs font-medium rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 transition-colors disabled:opacity-50"
        >
          {completing ? 'Completing…' : 'Mark complete'}
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
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchAssets = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }

    try {
      const res = await fetch(api('/api/asset-health/maintenance'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAssets(data.assets || []);
      } else {
        setError(data.message || 'Failed to load maintenance assets');
      }
    } catch {
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'complete' }),
      });

      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a._id !== assetId));
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to complete maintenance');
      }
    } catch {
      alert('Network error');
    }
  };

  const isAssetOverdue = (a: MaintenanceAsset) =>
    a.maintenanceStartDate
      ? Date.now() - new Date(a.maintenanceStartDate).getTime() > OVERDUE_MS
      : false;

  const filteredAssets = filter === 'overdue' ? assets.filter(isAssetOverdue) : assets;
  const overdueCount = assets.filter(isAssetOverdue).length;
  const onTrackCount = assets.length - overdueCount;

  if (loading) {
    return <LoadingSpinner message="Loading maintenance assets..." />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Maintenance</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Assets currently under maintenance — overdue if open longer than 2 days.
        </p>
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-amber-500/50 bg-gradient-to-r from-amber-950/20 to-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest mb-2">Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <SummaryCard
            label="Under maintenance"
            value={assets.length}
            hint={assets.length === 1 ? '1 asset' : `${assets.length} assets`}
            accent="text-amber-300"
          />
          <div
            className={`px-2 py-1.5 rounded-lg border ${
              overdueCount > 0
                ? 'border-red-500/40 bg-red-950/40'
                : 'border-gray-700/40 bg-gray-900/30'
            }`}
          >
            <p className={`text-[10px] uppercase tracking-wide ${overdueCount > 0 ? 'text-red-400/80' : 'text-gray-500'}`}>
              Overdue
            </p>
            <p className={`text-sm font-semibold mt-0.5 tabular-nums ${overdueCount > 0 ? 'text-red-400' : 'text-emerald-300'}`}>
              {overdueCount}
            </p>
            <p className={`text-[11px] mt-0.5 ${overdueCount > 0 ? 'text-red-400/60' : 'text-gray-600'}`}>
              Open more than 2 days
            </p>
          </div>
          <SummaryCard
            label="On track"
            value={onTrackCount}
            hint="Within 2-day window"
            accent="text-blue-300"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            filter === 'all'
              ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:bg-gray-700/60 hover:text-gray-200'
          }`}
        >
          All ({assets.length})
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            filter === 'overdue'
              ? 'bg-red-500/20 text-red-200 border-red-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:bg-gray-700/60 hover:text-gray-200'
          }`}
        >
          Overdue ({overdueCount})
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {filteredAssets.length === 0 ? (
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-200">
            {filter === 'overdue' ? 'No overdue maintenance' : 'No assets under maintenance'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {filter === 'overdue'
              ? 'All open maintenance tasks are within the 2-day window.'
              : 'All assets are out of maintenance.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredAssets.map((asset) => (
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
