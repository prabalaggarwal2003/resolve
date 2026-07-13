'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import InsightsModuleNav from '@/components/insights/InsightsModuleNav';
import InsightRuleCard from '@/components/insights/InsightRuleCard';
import { canWrite } from '@/lib/permissions';
import {
  UpgradePrompt,
  canAccessFeature,
  fetchOrgSubscription,
  getStoredSubscription,
} from '@/lib/subscriptionUtils';
import {
  api,
  deleteInsightRule,
  fetchInsightCatalog,
  fetchInsightRules,
  resetInsightRule,
  updateInsightRule,
  type InsightCatalog,
  type InsightRule,
} from '@/lib/insights';

export default function InsightRulesPage() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [rules, setRules] = useState<InsightRule[]>([]);
  const [catalog, setCatalog] = useState<InsightCatalog | null>(null);
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  const hasAccess = canAccessFeature(tier, 'insights') && !isExpired;
  const canEdit = canWrite('insights');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleList, cat] = await Promise.all([fetchInsightRules(), fetchInsightCatalog()]);
      setRules(ruleList);
      setCatalog(cat);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgSubscription(api).then((sub) => {
      setTier(sub.tier);
      setIsExpired(sub.isExpired);
    });
  }, []);

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    load();
  }, [hasAccess, load]);

  const filtered = rules.filter((r) => {
    if (category && r.category !== category) return false;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    }
    return true;
  });

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <UpgradePrompt feature="Insights" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden mx-auto px-4 py-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Insight Rules</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rules.length} rules · {rules.filter((r) => r.enabled).length} enabled</p>
        </div>
        {canEdit && (
          <Link href="/dashboard/insights/builder" className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white no-underline">
            + Custom rule
          </Link>
        )}
      </div>

      <InsightsModuleNav />

      {error && <div className="text-sm text-red-300">{error}</div>}

      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 min-w-[160px] px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
          placeholder="Search rules…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {(catalog?.categories || []).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading || !catalog ? (
        <LoadingSpinner message="Loading rules…" />
      ) : (
        <div className="w-full min-w-0 space-y-3">
          {filtered.map((rule) => (
            <InsightRuleCard
              key={rule._id}
              rule={rule}
              catalog={catalog}
              canEdit={canEdit}
              onToggle={async (enabled) => {
                const updated = await updateInsightRule(rule._id, { enabled });
                setRules((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
              }}
              onSave={async (patch) => {
                const updated = await updateInsightRule(rule._id, patch);
                setRules((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
              }}
              onReset={
                rule.isBuiltin
                  ? async () => {
                      const updated = await resetInsightRule(rule._id);
                      setRules((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
                    }
                  : undefined
              }
              onDelete={
                !rule.isBuiltin
                  ? async () => {
                      if (!confirm(`Delete rule "${rule.name}"?`)) return;
                      await deleteInsightRule(rule._id);
                      setRules((prev) => prev.filter((r) => r._id !== rule._id));
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
