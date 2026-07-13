'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import UpgradeNudges from '@/components/UpgradeNudges';
import LoadingSpinner from '@/components/LoadingSpinner';
import AssetsListToolbar from '@/components/assets/AssetsListToolbar';
import AssetsDataTable, { type AssetRow } from '@/components/assets/AssetsDataTable';
import { useAssetListPreferences } from '@/hooks/useAssetListPreferences';
import { canWrite } from '@/lib/permissions';
import type { ColumnId } from '@/lib/assetsTableConfig';
import { hasActiveBasicFilters } from '@/lib/assetsTableConfig';
import { breadcrumbForNode, flattenTree, type LocationTreeNode } from '@/lib/locations';
import { fetchInsightMatch } from '@/lib/insights';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

type AssetStats = {
  total: number;
  available: number;
  in_use: number;
  under_maintenance: number;
};

function SummaryCard({ label, value, accent = 'text-gray-100' }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 tabular-nums truncate ${accent}`}>{value}</p>
    </div>
  );
}

function AssetsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { prefs, updatePrefs, loaded: prefsLoaded } = useAssetListPreferences();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<AssetStats>({ total: 0, available: 0, in_use: 0, under_maintenance: 0 });
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'premium'>('free');
  const [dismissedNudges, setDismissedNudges] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [locationTree, setLocationTree] = useState<LocationTreeNode[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ _id: string; vendorId: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([]);
  const [customFilterFields, setCustomFilterFields] = useState<{ field: string; label: string; type: 'text' | 'number' | 'date' | 'select' }[]>([]);
  const [assetGroups, setAssetGroups] = useState<{ _id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchDebounce, setSearchDebounce] = useState(prefs.globalSearch);

  const assignedToParam = searchParams.get('assignedTo') || '';
  const insightRuleKeyParam = searchParams.get('insightRuleKey') || '';

  const [insightFilter, setInsightFilter] = useState<{
    ruleKey: string;
    name: string;
    assetIds: string[] | null;
    loading: boolean;
    error: string;
  }>({ ruleKey: '', name: '', assetIds: null, loading: false, error: '' });

  const canAddAsset = canWrite('assets');
  const canEdit = canWrite('assets');
  const canDownloadQR = canWrite('assets');

  const visibleColumns = prefs.columns.filter((c) => c.visible).map((c) => c.id as ColumnId);
  const totalPages = Math.ceil(total / prefs.pageSize);

  useEffect(() => {
    const savedNudges = localStorage.getItem('dismissedNudges');
    if (savedNudges) setDismissedNudges(JSON.parse(savedNudges));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(prefs.globalSearch), 350);
    return () => clearTimeout(t);
  }, [prefs.globalSearch]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounce, prefs.advancedFilters, prefs.basicFilters, prefs.sort, prefs.order, prefs.pageSize, assignedToParam, insightRuleKeyParam]);

  useEffect(() => {
    if (!insightRuleKeyParam) {
      setInsightFilter({ ruleKey: '', name: '', assetIds: null, loading: false, error: '' });
      return;
    }

    let cancelled = false;
    setInsightFilter((prev) => ({
      ...prev,
      ruleKey: insightRuleKeyParam,
      loading: true,
      error: '',
      assetIds: null,
    }));

    fetchInsightMatch(insightRuleKeyParam)
      .then((match) => {
        if (cancelled) return;
        if (match.ruleType !== 'asset') {
          setInsightFilter({
            ruleKey: insightRuleKeyParam,
            name: match.name,
            assetIds: [],
            loading: false,
            error: 'This insight does not filter assets. Use the link from the Insights page instead.',
          });
          return;
        }
        setInsightFilter({
          ruleKey: insightRuleKeyParam,
          name: match.name,
          assetIds: match.assetIds,
          loading: false,
          error: '',
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setInsightFilter({
          ruleKey: insightRuleKeyParam,
          name: '',
          assetIds: [],
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load insight filter',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [insightRuleKeyParam]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    Promise.all([
      fetch(api('/api/departments'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/locations/tree'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/vendors?status=Active'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/users'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/asset-groups'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/asset-templates'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([deptRes, locRes, vendorsRes, usersRes, groupsRes, tplRes]) => {
        if (deptRes.departments) setDepartments(deptRes.departments);
        if (locRes.tree) {
          setLocationTree(locRes.tree);
          setLocations(
            flattenTree(locRes.tree).map((n) => ({
              _id: n._id,
              name: breadcrumbForNode(n),
            }))
          );
        }
        if (groupsRes.groups) setAssetGroups(groupsRes.groups);
        if (Array.isArray(vendorsRes)) setVendors(vendorsRes.filter((v: { status: string }) => v.status === 'Active'));
        if (usersRes.users) setUsers(usersRes.users);
        if (tplRes.templates) {
          const names = tplRes.templates.map((t: { name: string }) => t.name);
          setCategories(Array.from(new Set(names)) as string[]);
          const seen = new Set<string>();
          const custom: { field: string; label: string; type: 'text' | 'number' | 'date' | 'select' }[] = [];
          for (const tpl of tplRes.templates) {
            for (const f of tpl.fields || []) {
              if (f.builtIn || ['status', 'tags', 'location'].includes(f.type)) continue;
              const key = `custom:${f.key}`;
              if (seen.has(key)) continue;
              seen.add(key);
              const type =
                f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'select' ? 'select' : 'text';
              custom.push({ field: key, label: f.label, type });
            }
          }
          setCustomFilterFields(custom);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(api('/api/payments/subscription-status'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setSubscriptionTier(data.tier || 'free'))
      .catch(() => {});
  }, []);

  const fetchStats = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all(
      (['', 'available', 'in_use', 'under_maintenance'] as const).map((s) => {
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
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!prefsLoaded) return;
    if (insightRuleKeyParam && insightFilter.loading) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (searchDebounce.trim()) params.set('search', searchDebounce.trim());
    if (assignedToParam) params.set('assignedTo', assignedToParam);
    if (insightRuleKeyParam && insightFilter.assetIds !== null) {
      params.set('assetIds', insightFilter.assetIds.join(','));
    }
    const bf = prefs.basicFilters;
    if (bf?.status) params.set('status', bf.status);
    if (bf?.category) params.set('category', bf.category);
    if (bf?.departmentId) params.set('departmentId', bf.departmentId);
    if (bf?.groupId) params.set('groupId', bf.groupId);
    const locationIds = bf?.locationIds?.filter(Boolean) ?? [];
    if (locationIds.length) {
      params.set('locationIds', locationIds.join(','));
      if (bf?.locationIncludeChildren === false) {
        params.set('locationIncludeChildren', 'false');
      }
    }
    if (prefs.advancedFilters.length) {
      params.set('filters', JSON.stringify(prefs.advancedFilters));
    }
    params.set('sort', prefs.sort);
    params.set('order', prefs.order);
    params.set('page', String(page));
    params.set('limit', String(prefs.pageSize));

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
  }, [prefsLoaded, searchDebounce, assignedToParam, insightRuleKeyParam, insightFilter.loading, insightFilter.assetIds, prefs.advancedFilters, prefs.basicFilters, prefs.sort, prefs.order, prefs.pageSize, page]);

  const clearInsightFilter = () => {
    router.replace('/dashboard/assets');
  };

  const downloadQRPDF = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(api('/api/qr-pdf/download'), { headers: { Authorization: `Bearer ${token}` } });
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
        alert((await res.json()).message || 'Failed to download PDF');
      }
    } catch {
      alert('Failed to download PDF');
    }
  };

  const hasActiveFilters =
    Boolean(searchDebounce.trim()) ||
    prefs.advancedFilters.length > 0 ||
    hasActiveBasicFilters(prefs.basicFilters) ||
    Boolean(insightRuleKeyParam);

  if (!prefsLoaded) return <LoadingSpinner message="Loading preferences..." />;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Assets</h1>
          <p className="text-gray-400 mt-1 text-sm">Table view with saved filters, columns, and views — synced to your account.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/assets/templates" className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 no-underline`}>
            Asset templates
          </Link>
          {canDownloadQR && (
            <button onClick={downloadQRPDF} className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}>
              Download QR PDF
            </button>
          )}
          {canAddAsset && (
            <Link href="/dashboard/assets/new" className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 no-underline`}>
              + Add asset
            </Link>
          )}
        </div>
      </div>

      {insightRuleKeyParam ? (
        <div className="mb-4 px-4 py-3 rounded-xl border border-violet-500/30 bg-violet-500/10 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-violet-300 uppercase tracking-wide">Insight filter</p>
            {insightFilter.loading ? (
              <p className="text-sm text-gray-400 mt-0.5">Loading matching assets…</p>
            ) : insightFilter.error ? (
              <p className="text-sm text-red-300 mt-0.5">{insightFilter.error}</p>
            ) : (
              <p className="text-sm text-gray-300 mt-0.5">
                Showing assets for <span className="font-medium text-violet-200">{insightFilter.name}</span>
                {insightFilter.assetIds !== null ? ` (${insightFilter.assetIds.length})` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={clearInsightFilter}
            className={`${buttonClass} border-gray-700/60 text-gray-300 hover:text-gray-100`}
          >
            Clear insight filter
          </button>
        </div>
      ) : null}

      <UpgradeNudges
        userTier={subscriptionTier}
        assetCount={stats.total}
        dismissedNudges={dismissedNudges}
        onDismiss={(nudgeId) => {
          const updated = [...dismissedNudges, nudgeId];
          setDismissedNudges(updated);
          localStorage.setItem('dismissedNudges', JSON.stringify(updated));
        }}
      />

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard label="Total assets" value={stats.total} accent="text-blue-300" />
          <SummaryCard label="Available" value={stats.available} accent="text-emerald-300" />
          <SummaryCard label="In use" value={stats.in_use} accent="text-violet-300" />
          <SummaryCard label={hasActiveFilters ? 'Matching filters' : 'Under maintenance'} value={hasActiveFilters ? total : stats.under_maintenance} accent="text-amber-300" />
        </div>
      </div>

      <AssetsListToolbar
        prefs={prefs}
        onUpdate={updatePrefs}
        departments={departments}
        locations={locations}
        locationTree={locationTree}
        assetGroups={assetGroups}
        vendors={vendors}
        users={users}
        categories={categories}
        customFilterFields={customFilterFields}
      />

      {loading && <LoadingSpinner message="Loading assets..." />}

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && assets.length === 0 && (
        <div className="rounded-xl border border-gray-700/60 px-4 py-10 text-center">
          <p className="text-sm text-gray-300">No assets found</p>
          <p className="text-xs text-gray-500 mt-1">Try changing search or filters.</p>
        </div>
      )}

      {!loading && !error && assets.length > 0 && (
        <>
          <AssetsDataTable
            assets={assets}
            visibleColumns={visibleColumns}
            canEdit={canEdit}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-1">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * prefs.pageSize + 1}–{Math.min(page * prefs.pageSize, total)} of {total}
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
                Page {page} of {totalPages || 1}
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
