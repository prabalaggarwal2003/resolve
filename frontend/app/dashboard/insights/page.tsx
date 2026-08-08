'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import InsightsModuleNav from '@/components/insights/InsightsModuleNav';
import InsightDashboardCards from '@/components/insights/InsightDashboardCards';
import InsightsPagination, { INSIGHTS_PAGE_SIZE } from '@/components/insights/InsightsPagination';
import {
  UpgradePrompt,
  canAccessFeature,
  fetchOrgSubscription,
  getStoredSubscription,
} from '@/lib/subscriptionUtils';
import { canWrite } from '@/lib/permissions';
import { api, fetchInsightDashboard, type InsightDashboardData } from '@/lib/insights';

function SummaryCard({ label, value, accent = 'text-gray-100' }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className={`text-lg font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

export default function InsightsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [data, setData] = useState<InsightDashboardData | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const hasAccess = canAccessFeature(tier, 'insights') && !isExpired;
  const canAddInsight = canWrite('insights');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchInsightDashboard();
      setData(result);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insights');
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

  const insights = data?.insights || [];
  const pageInsights = useMemo(() => {
    const start = (page - 1) * INSIGHTS_PAGE_SIZE;
    return insights.slice(start, start + INSIGHTS_PAGE_SIZE);
  }, [insights, page]);

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-4">Insights</h1>
        <UpgradePrompt feature="Insights" />
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 py-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Insights</h1>
          <p className="text-sm text-gray-500 mt-0.5">Simple alerts when something needs attention</p>
        </div>
        <div className="flex items-center gap-2">
          {canAddInsight && (
            <Link
              href="/dashboard/insights/rules?new=1"
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white no-underline"
            >
              + Add insight
            </Link>
          )}
          <button type="button" onClick={load} className="px-3 py-1.5 text-sm rounded-lg border border-gray-700/60 text-gray-300 hover:bg-gray-800/60">
            Refresh
          </button>
        </div>
      </div>

      <InsightsModuleNav />

      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>
      )}

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard label="Active alerts" value={data.summary.activeInsights} accent="text-violet-300" />
          <SummaryCard label="Critical" value={data.summary.criticalCount} accent="text-red-300" />
          <SummaryCard label="Warnings" value={data.summary.warningCount} accent="text-amber-300" />
          <SummaryCard label="Rules on" value={`${data.summary.enabledRules}/${data.summary.totalRules}`} />
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Checking insights…" />
      ) : data?.notifications?.showOnDashboard === false ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-gray-700/50">
          <p className="text-gray-400 mb-1">Insights are hidden</p>
          <p className="text-sm text-gray-600">
            Turn them back on in{' '}
            <Link href="/dashboard/insights/rules#defaults" className="text-blue-400 hover:text-blue-300 no-underline">
              Configure → Defaults
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <InsightDashboardCards insights={pageInsights} />
          <InsightsPagination
            page={page}
            total={insights.length}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
