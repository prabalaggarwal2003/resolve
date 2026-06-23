'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import UpgradeNudges from '@/components/UpgradeNudges';
import LoadingSpinner from '@/components/LoadingSpinner';

const CATEGORIES = [
  'Projector',
  'Whiteboard',
  'Desktop',
  'Laptop',
  'AC',
  'Furniture',
  'Lab Equipment',
  'Printer',
  'Other',
];

type Asset = {
  _id: string;
  assetId: string;
  name: string;
  category: string;
  status: string;
  locationId?: { name: string; path?: string };
  departmentId?: { name: string };
  assignedTo?: { _id: string; name: string; email: string };
};

const STATUS_BADGE: Record<string, string> = {
  available: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  in_use: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  under_maintenance: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  retired: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
  working: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  needs_repair: 'text-red-300 bg-red-500/15 border-red-500/30',
  out_of_service: 'text-red-300 bg-red-500/15 border-red-500/30',
};

const STATUS_ACCENT: Record<string, string> = {
  available: 'border-l-emerald-500/50',
  in_use: 'border-l-blue-500/50',
  under_maintenance: 'border-l-amber-500/50',
  retired: 'border-l-gray-500/50',
  working: 'border-l-emerald-500/50',
  needs_repair: 'border-l-red-500/50',
  out_of_service: 'border-l-red-500/50',
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  in_use: 'In use',
  under_maintenance: 'Under maintenance',
  retired: 'Retired',
  working: 'Working',
  needs_repair: 'Needs repair',
  out_of_service: 'Out of service',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

const inputClass =
  'px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

function SummaryCard({
  label,
  value,
  accent = 'text-gray-100',
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 tabular-nums truncate ${accent}`}>{value}</p>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium text-gray-200 mt-0.5 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

function AssetCard({
  asset,
  canEditAsset,
}: {
  asset: Asset;
  canEditAsset: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-700/60 border-l-2 ${
        STATUS_ACCENT[asset.status] || 'border-l-gray-500/50'
      } bg-gray-800/40 px-4 py-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Link
              href={`/dashboard/assets/${asset._id}`}
              className="text-sm font-semibold text-blue-300 hover:text-blue-200 font-mono"
            >
              {asset.assetId}
            </Link>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${
                STATUS_BADGE[asset.status] || STATUS_BADGE.retired
              }`}
            >
              {STATUS_LABELS[asset.status] || asset.status?.replace(/_/g, ' ') || '—'}
            </span>
          </div>
          <p className="text-xs text-gray-300 truncate">{asset.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <DetailTile label="Category" value={asset.category ?? '—'} />
        <DetailTile label="Department" value={asset.departmentId?.name ?? '—'} />
        <DetailTile label="Assigned to" value={asset.assignedTo?.name ?? 'Unassigned'} />
        <DetailTile
          label="Location"
          value={asset.locationId?.path || asset.locationId?.name || '—'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-700/40">
        <Link
          href={`/dashboard/assets/${asset._id}`}
          className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20`}
        >
          View
        </Link>
        {canEditAsset && (
          <Link
            href={`/dashboard/assets/${asset._id}/edit`}
            className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
          >
            Edit
          </Link>
        )}
      </div>
    </div>
  );
}

type AssetStats = {
  total: number;
  available: number;
  in_use: number;
  under_maintenance: number;
};

function AssetsPageContent() {
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<AssetStats>({
    total: 0,
    available: 0,
    in_use: 0,
    under_maintenance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'premium'>('free');
  const [dismissedNudges, setDismissedNudges] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  useEffect(() => {
    const q = searchParams.get('assignedTo') || '';
    setAssignedToFilter(q);
  }, [searchParams]);

  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(statusFilter) ||
    Boolean(categoryFilter) ||
    Boolean(departmentFilter) ||
    Boolean(assignedToFilter);

  useEffect(() => {
    const u = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (u) try { setUser(JSON.parse(u)); } catch (_) {}

    const saved = localStorage.getItem('assetCategories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCategories(Array.from(new Set(CATEGORIES.concat(parsed))));
      } catch (_) {}
    }

    const savedNudges = localStorage.getItem('dismissedNudges');
    if (savedNudges) setDismissedNudges(JSON.parse(savedNudges));
  }, []);

  useEffect(() => {
    const fetchSubscription = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return;
      try {
        const res = await fetch(api('/api/payments/subscription-status'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSubscriptionTier(data.tier || 'free');
        }
      } catch (_) {}
    };
    fetchSubscription();
  }, []);

  const fetchStats = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    const statuses = ['', 'available', 'in_use', 'under_maintenance'] as const;

    Promise.all(
      statuses.map((s) => {
        const q = s ? `?status=${s}&limit=1` : '?limit=1';
        return fetch(api(`/api/assets${q}`), { headers }).then((r) => r.json());
      })
    )
      .then((results) => {
        setStats({
          total: results[0].total || 0,
          available: results[1].total || 0,
          in_use: results[2].total || 0,
          under_maintenance: results[3].total || 0,
        });
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    Promise.all([
      fetch(api('/api/departments'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/users'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([deptRes, usersRes]) => {
        if (deptRes.departments) setDepartments(deptRes.departments);
        if (usersRes.users) setUsers(usersRes.users);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (departmentFilter) params.set('departmentId', departmentFilter);
    if (assignedToFilter) params.set('assignedTo', assignedToFilter);
    params.set('sort', sort);
    params.set('order', order);
    params.set('page', String(page));
    params.set('limit', String(limit));

    fetch(api(`/api/assets?${params.toString()}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.assets) {
          setAssets(data.assets);
          setTotal(data.total || 0);
        } else {
          setError(data.message || 'Failed to load');
        }
      })
      .catch(() => setError('Failed to load assets'))
      .finally(() => setLoading(false));
  }, [search, statusFilter, categoryFilter, departmentFilter, assignedToFilter, sort, order, user?.id, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter, departmentFilter, assignedToFilter]);

  const canAddAsset = ['super_admin', 'admin'].includes(user?.role ?? '');
  const canEdit = ['super_admin', 'admin'].includes(user?.role ?? '');
  const canDownloadQR = ['super_admin', 'admin'].includes(user?.role ?? '');

  const downloadQRPDF = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      const res = await fetch(api('/api/qr-pdf/download'), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `asset-qr-codes-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to download PDF');
      }
    } catch {
      alert('Failed to download PDF');
    }
  };

  const assignedUser = users.find((u) => u._id === assignedToFilter);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            {assignedToFilter && assignedUser
              ? `Assets — ${assignedUser.name}`
              : 'Assets'}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Search, filter, and manage your asset inventory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canDownloadQR && (
            <button
              onClick={downloadQRPDF}
              className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}
            >
              Download QR PDF
            </button>
          )}
          {canAddAsset && (
            <Link
              href="/dashboard/assets/new"
              className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20`}
            >
              + Add asset
            </Link>
          )}
        </div>
      </div>

      <UpgradeNudges
        userTier={subscriptionTier}
        assetCount={stats.total}
        dismissedNudges={dismissedNudges}
        onDismiss={(nudgeId) => {
          const updated = [...dismissedNudges, nudgeId];
          setDismissedNudges(updated);
          if (typeof window !== 'undefined') {
            localStorage.setItem('dismissedNudges', JSON.stringify(updated));
          }
        }}
      />

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard label="Total assets" value={stats.total} accent="text-blue-300" />
          <SummaryCard label="Available" value={stats.available} accent="text-emerald-300" />
          <SummaryCard label="In use" value={stats.in_use} accent="text-violet-300" />
          <SummaryCard
            label={hasActiveFilters ? 'Matching filters' : 'Under maintenance'}
            value={hasActiveFilters ? total : stats.under_maintenance}
            accent={hasActiveFilters ? 'text-amber-300' : 'text-amber-300'}
          />
        </div>
      </div>

      {assignedToFilter && assignedUser && (
        <div className="mb-4 flex flex-wrap items-center gap-3 px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/5 text-xs text-blue-200">
          <span>
            Showing assets assigned to <strong className="text-blue-100">{assignedUser.name}</strong>
            <span className="text-blue-400/70"> ({assignedUser.email})</span>
          </span>
          <button
            type="button"
            onClick={() => setAssignedToFilter('')}
            className={`${buttonClass} ml-auto border-blue-500/40 text-blue-300 hover:bg-blue-500/10`}
          >
            Clear
          </button>
        </div>
      )}

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest mb-3">Filters</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Search ID, name, serial…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} w-full sm:w-56`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${inputClass} sm:w-44`}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {user?.role !== 'manager' && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className={`${inputClass} sm:w-44`}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {user?.role !== 'manager' && (
            <select
              value={assignedToFilter}
              onChange={(e) => setAssignedToFilter(e.target.value)}
              className={`${inputClass} sm:w-52`}
            >
              <option value="">All assignees</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`${inputClass} sm:w-36`}
          >
            <option value="">All types</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={`${sort}-${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split('-') as [string, 'asc' | 'desc'];
              setSort(s);
              setOrder(o);
            }}
            className={`${inputClass} sm:w-44`}
          >
            <option value="createdAt-desc">Newest first</option>
            <option value="createdAt-asc">Oldest first</option>
            <option value="purchaseDate-desc">Purchase date (new)</option>
            <option value="purchaseDate-asc">Purchase date (old)</option>
            <option value="name-asc">Name A–Z</option>
            <option value="cost-desc">Value (high)</option>
          </select>
        </div>
      </div>

      {loading && <LoadingSpinner message="Loading assets..." />}

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && assets.length === 0 && (
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-4 py-10 text-center">
          <p className="text-sm text-gray-300">No assets found</p>
          <p className="text-xs text-gray-500 mt-1">
            Try changing filters or add your first asset.
          </p>
        </div>
      )}

      {!loading && !error && assets.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {assets.map((asset) => (
              <AssetCard key={asset._id} asset={asset} canEditAsset={canEdit} />
            ))}
          </div>

          {total > limit && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-1">
              <p className="text-xs text-gray-500">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 disabled:opacity-40`}
                >
                  Previous
                </button>
                <span className="px-2 text-xs text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 disabled:opacity-40`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading assets..." />}>
      <AssetsPageContent />
    </Suspense>
  );
}
