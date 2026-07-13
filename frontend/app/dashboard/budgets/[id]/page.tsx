'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import BudgetModuleNav from '@/components/budgets/BudgetModuleNav';
import BudgetDetailFields, { type BudgetRefData } from '@/components/budgets/BudgetDetailFields';
import {
  api,
  authHeaders,
  fetchBudget,
  fetchBudgetConfig,
  type Budget,
  type BudgetOrgConfig,
} from '@/lib/budgets';
import { UpgradePrompt, canAccessFeature, fetchOrgSubscription, getStoredSubscription } from '@/lib/subscriptionUtils';

function flattenLocations(nodes: { _id: string; name: string; children?: unknown[] }[]): { _id: string; name: string }[] {
  const out: { _id: string; name: string }[] = [];
  const walk = (list: typeof nodes, prefix = '') => {
    for (const n of list) {
      const label = prefix ? `${prefix} / ${n.name}` : n.name;
      out.push({ _id: n._id, name: label });
      if (Array.isArray(n.children) && n.children.length) walk(n.children as typeof nodes, label);
    }
  };
  walk(nodes);
  return out;
}

export default function BudgetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || '');

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [config, setConfig] = useState<BudgetOrgConfig | null>(null);
  const [refData, setRefData] = useState<BudgetRefData>({});
  const [error, setError] = useState('');

  const hasAccess = canAccessFeature(tier, 'budgets') && !isExpired;

  useEffect(() => {
    fetchOrgSubscription(api).then((sub) => {
      setTier(sub.tier);
      setIsExpired(sub.isExpired);
    });
  }, []);

  useEffect(() => {
    if (!hasAccess || !id) return;
    setLoading(true);
    setError('');
    const headers = authHeaders();
    const safeJson = (url: string) => fetch(api(url), { headers }).then((r) => r.json()).catch(() => ({}));
    Promise.all([
      fetchBudget(id),
      fetchBudgetConfig(),
      safeJson('/api/departments'),
      safeJson('/api/asset-groups'),
      safeJson('/api/locations/tree'),
      safeJson('/api/vendors'),
      safeJson('/api/asset-templates'),
      safeJson('/api/users'),
    ])
      .then(([b, cfg, dept, group, loc, vendor, tpl, user]) => {
        setBudget(b);
        setConfig(cfg);
        setRefData({
          departments: dept.departments || dept || [],
          groups: group.groups || group || [],
          locations: flattenLocations(loc.tree || loc.locations || loc || []),
          vendors: vendor.vendors || vendor || [],
          templates: tpl.templates || tpl || [],
          users: user.users || user || [],
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load budget'))
      .finally(() => setLoading(false));
  }, [hasAccess, id]);

  if (!hasAccess) {
    return (
      <div className="p-4">
        <UpgradePrompt feature="Budgets & Procurement" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      <BudgetModuleNav />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.push('/dashboard/budgets')}
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          ← Back to budgets
        </button>
        {budget && (
          <div className="ml-auto flex items-center gap-3">
            <Link
              href={`/dashboard/budgets/history?budgetId=${budget._id}`}
              className="text-sm text-gray-400 hover:text-gray-200 no-underline"
            >
              View history →
            </Link>
            <Link
              href="/dashboard/budgets"
              className="text-sm text-blue-400 hover:text-blue-300 no-underline"
            >
              Edit budget
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading budget…" />
      ) : budget ? (
        <div className="max-w-3xl rounded-xl border border-gray-800/80 bg-gray-900/20 p-5">
          <BudgetDetailFields budget={budget} config={config} refData={refData} />
        </div>
      ) : null}
    </div>
  );
}
