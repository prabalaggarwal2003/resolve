'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import InsightDashboardCards from '@/components/insights/InsightDashboardCards';
import InsightsPagination, { INSIGHTS_PAGE_SIZE } from '@/components/insights/InsightsPagination';
import { fetchInsightDashboard, type InsightDashboardData } from '@/lib/insights';

export default function HomeInsightsPanel() {
  const [data, setData] = useState<InsightDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

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
    load();
  }, [load]);

  const insights = data?.insights || [];
  const pageInsights = useMemo(() => {
    const start = (page - 1) * INSIGHTS_PAGE_SIZE;
    return insights.slice(start, start + INSIGHTS_PAGE_SIZE);
  }, [insights, page]);

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <p className="text-[10px] text-gray-500 uppercase">Insights</p>
          <p className="text-xs text-gray-500">Alerts from your rules — newest first</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && data ? (
            <span className="text-xs text-gray-500">{insights.length} shown</span>
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
        <div className="space-y-2">
          <InsightDashboardCards
            insights={pageInsights}
            loading={loading}
            scrollable
            maxHeight="320px"
          />
          {!loading && (
            <InsightsPagination
              page={page}
              total={insights.length}
              onChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
