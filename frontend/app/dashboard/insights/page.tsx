'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import InsightsModuleNav from '@/components/insights/InsightsModuleNav';
import InsightDashboardCards from '@/components/insights/InsightDashboardCards';
import {
  UpgradePrompt,
  canAccessFeature,
  fetchOrgSubscription,
  getStoredSubscription,
} from '@/lib/subscriptionUtils';
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

  const hasAccess = canAccessFeature(tier, 'insights') && !isExpired;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchInsightDashboard();
      setData(result);
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

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-4">Insights</h1>
        <UpgradePrompt feature="Insights" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Insights</h1>
          <p className="text-sm text-gray-500 mt-0.5">Proactive alerts from your asset, budget, and maintenance data</p>
        </div>
        <button type="button" onClick={load} className="px-3 py-1.5 text-sm rounded-lg border border-gray-700/60 text-gray-300 hover:bg-gray-800/60">
          Refresh
        </button>
      </div>

      <InsightsModuleNav />

      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>
      )}

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <SummaryCard label="Active insights" value={data.summary.activeInsights} accent="text-violet-300" />
          <SummaryCard label="Critical" value={data.summary.criticalCount} accent="text-red-300" />
          <SummaryCard label="Warnings" value={data.summary.warningCount} accent="text-amber-300" />
          <SummaryCard label="Info" value={data.summary.infoCount} />
          <SummaryCard label="Rules enabled" value={`${data.summary.enabledRules}/${data.summary.totalRules}`} />
          <SummaryCard label="Assets affected" value={data.summary.affectedAssets} />
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Evaluating insight rules…" />
      ) : data?.notifications?.showOnDashboard === false ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-gray-700/50">
          <p className="text-gray-400 mb-1">Insights hidden on dashboard</p>
          <p className="text-sm text-gray-600">
            Enable &quot;Show insights on Insights dashboard&quot; in{' '}
            <Link href="/dashboard/insights/thresholds" className="text-blue-400 hover:text-blue-300 no-underline">
              Thresholds settings
            </Link>
            .
          </p>
        </div>
      ) : (
        <InsightDashboardCards insights={data?.insights || []} />
      )}
    </div>
  );
}
