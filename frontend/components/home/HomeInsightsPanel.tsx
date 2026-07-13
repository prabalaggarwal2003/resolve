'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import InsightDashboardCards from '@/components/insights/InsightDashboardCards';
import { fetchInsightDashboard, type InsightDashboardData } from '@/lib/insights';

export default function HomeInsightsPanel() {
  const [data, setData] = useState<InsightDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    load();
  }, [load]);

  const insights = data?.insights || [];
  const maxItems = data?.notifications?.maxDashboardItems ?? 20;

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <p className="text-[10px] text-gray-500 uppercase">Insights</p>
          <p className="text-xs text-gray-500">Active alerts from your asset and budget data</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && data ? (
            <span className="text-xs text-gray-500">{insights.length} active</span>
          ) : null}
          <button
            type="button"
            onClick={load}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Refresh
          </button>
          <Link href="/dashboard/insights" className="text-xs text-blue-400 hover:text-blue-300 no-underline">
            All insights →
          </Link>
        </div>
      </div>

      {error ? (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>
      ) : (
        <InsightDashboardCards
          insights={insights.slice(0, maxItems)}
          loading={loading}
          scrollable
          maxHeight="320px"
        />
      )}
    </div>
  );
}
