'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { fetchReportDashboard } from '@/lib/reportStudio';
import { formatOrgDateTime } from '@/lib/orgTimezone';

function Card({
  title,
  children,
  href,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
        {href && (
          <Link href={href} className="text-[11px] text-amber-300/80 hover:text-amber-200 no-underline">
            View all
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-gray-500 py-2">{text}</p>;
}

export default function ReportStudioDashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading Report Studio…" />;
  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>
    );
  }

  const recent = (data?.recentlyGenerated as { _id: string; name: string; lastRunAt?: string; updatedAt?: string }[]) || [];
  const favourites = (data?.favourites as { _id: string; name: string }[]) || [];
  const scheduled = (data?.scheduled as { _id: string; name: string; frequency?: string; reportId?: { name?: string } }[]) || [];
  const failed = (data?.failedScheduled as { _id: string; name: string; lastError?: string }[]) || [];
  const exports = (data?.exportHistory as { _id: string; reportName: string; format: string; createdAt: string; recordCount: number }[]) || [];
  const mostUsed = (data?.mostUsed as { _id: string; name: string; runCount?: number }[]) || [];
  const exportStats = (data?.exportStats as { _id: string; count: number; records: number }[]) || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/reports/builder"
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 no-underline"
        >
          Open Report Builder
        </Link>
        <Link
          href="/dashboard/reports/quick"
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 bg-gray-800/40 text-gray-300 hover:bg-gray-700/60 no-underline"
        >
          Quick Reports
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <Card title="Recently generated" href="/dashboard/reports/saved">
          {recent.length === 0 ? (
            <Empty text="No saved reports yet." />
          ) : (
            <ul className="space-y-1.5">
              {recent.map((r) => (
                <li key={r._id}>
                  <Link href={`/dashboard/reports/builder?id=${r._id}`} className="text-sm text-gray-200 hover:text-amber-200 no-underline">
                    {r.name}
                  </Link>
                  <p className="text-[10px] text-gray-500">
                    {r.lastRunAt ? `Last run ${formatOrgDateTime(r.lastRunAt)}` : 'Never run'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Favourites" href="/dashboard/reports/saved">
          {favourites.length === 0 ? (
            <Empty text="Star a saved report to see it here." />
          ) : (
            <ul className="space-y-1.5">
              {favourites.map((r) => (
                <li key={r._id}>
                  <Link href={`/dashboard/reports/builder?id=${r._id}`} className="text-sm text-gray-200 hover:text-amber-200 no-underline">
                    ★ {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Scheduled reports" href="/dashboard/reports/scheduled">
          {scheduled.length === 0 ? (
            <Empty text="No active schedules." />
          ) : (
            <ul className="space-y-1.5">
              {scheduled.map((s) => (
                <li key={s._id} className="text-sm text-gray-200">
                  {s.name}
                  <p className="text-[10px] text-gray-500">
                    {s.frequency} · {s.reportId?.name || 'Report'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Failed scheduled" href="/dashboard/reports/scheduled">
          {failed.length === 0 ? (
            <Empty text="No failed schedules." />
          ) : (
            <ul className="space-y-1.5">
              {failed.map((s) => (
                <li key={s._id} className="text-sm text-red-300">
                  {s.name}
                  {s.lastError && <p className="text-[10px] text-red-400/70">{s.lastError}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Export statistics" href="/dashboard/reports/history">
          {exportStats.length === 0 ? (
            <Empty text="No exports yet." />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {exportStats.map((s) => (
                <div key={s._id} className="rounded-lg border border-gray-700/40 bg-gray-900/30 px-2 py-1.5">
                  <p className="text-[10px] text-gray-500 uppercase">{s._id}</p>
                  <p className="text-sm font-semibold text-gray-100">{s.count}</p>
                  <p className="text-[10px] text-gray-600">{s.records} records</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Most used reports" href="/dashboard/reports/saved">
          {mostUsed.length === 0 ? (
            <Empty text="Run reports to populate this list." />
          ) : (
            <ul className="space-y-1.5">
              {mostUsed.map((r) => (
                <li key={r._id} className="flex justify-between gap-2 text-sm">
                  <Link href={`/dashboard/reports/builder?id=${r._id}`} className="text-gray-200 hover:text-amber-200 no-underline truncate">
                    {r.name}
                  </Link>
                  <span className="text-[10px] text-gray-500 shrink-0">{r.runCount || 0} runs</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Last generated exports" href="/dashboard/reports/history">
          {exports.length === 0 ? (
            <Empty text="Export a report to see history." />
          ) : (
            <ul className="space-y-1.5">
              {exports.slice(0, 5).map((e) => (
                <li key={e._id} className="text-sm text-gray-200">
                  {e.reportName}
                  <p className="text-[10px] text-gray-500">
                    {e.format.toUpperCase()} · {e.recordCount} rows · {formatOrgDateTime(e.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
