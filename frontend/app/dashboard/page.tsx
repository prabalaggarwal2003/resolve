'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Issue = {
  _id: string;
  ticketId: string;
  title: string;
  status: string;
  category: string;
  reporterName?: string;
  reports?: { reporterName: string }[];
  createdAt: string;
  assetId?: { _id: string; name: string; assetId: string };
};

type Summary = {
  totalAssets: number;
  openIssues: number;
  inProgressIssues: number;
  completedToday: number;
  myAssets: number;
  myReports: number;
  pendingReports: number;
  role: string;
  canReportOnly?: boolean;
};

const STATUS_CLASSES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-slate-600',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function StatusButtons({
  issueId,
  currentStatus,
  onUpdate,
}: {
  issueId: string;
  currentStatus: string;
  onUpdate: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const setStatus = async (status: string) => {
    if (!token || loading || status === currentStatus) return;
    setLoading(true);
    try {
      const res = await fetch(api(`/api/issues/${issueId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const options = [
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ].filter((o) => o.value !== currentStatus);

  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setStatus(o.value)}
          disabled={loading}
          className="px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const CAN_EDIT_ROLES = ['super_admin', 'admin', 'manager'];

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    try {
      const u = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (u) {
        const parsed = JSON.parse(u);
        setCanEdit(CAN_EDIT_ROLES.includes(parsed?.role ?? ''));
      }
    } catch (_) {}
  }, []);

  const fetchData = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(api('/api/dashboard/summary'), { headers }).then((r) => r.json()),
      fetch(api('/api/issues?limit=10'), { headers }).then((r) => r.json()),
    ])
      .then(([summaryData, issuesData]) => {
        if (summaryData.totalAssets !== undefined) setSummary(summaryData);
        if (issuesData.issues) setIssues(issuesData.issues);
        if (summaryData.message) setError(summaryData.message);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-slate-600 mb-6">
        Overview of assets and issues for your school or college
      </p>

      {loading && <p className="text-slate-600">Loading…</p>}
      {error && (
        <p className="p-4 bg-red-50 text-red-600 rounded-lg text-sm mb-4">{error}</p>
      )}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {summary.canReportOnly ? (
            <>
              <Card title="My Assets" value={String(summary.myAssets)} />
              <Card title="My Reports" value={String(summary.myReports)} />
              <Card title="Open Issues" value={String(summary.openIssues)} />
              <Card title="Completed Today" value={String(summary.completedToday)} />
            </>
          ) : (
            <>
              <Card title="Total Assets" value={String(summary.totalAssets)} />
              <Card title="Pending Reports" value={String(summary.pendingReports)} className="border-amber-200 bg-amber-50/50" />
              <Card title="Open Issues" value={String(summary.openIssues)} />
              <Card title="Completed Today" value={String(summary.completedToday)} />
            </>
          )}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Latest issues</h2>
        {issues.length === 0 && !loading && (
          <p className="text-slate-600">
            No issues yet. Report via QR scan or from an asset page.
          </p>
        )}
        {issues.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="p-3 text-sm font-medium text-slate-700">Ticket</th>
                    <th className="p-3 text-sm font-medium text-slate-700">Asset</th>
                    <th className="p-3 text-sm font-medium text-slate-700">Title</th>
                    <th className="p-3 text-sm font-medium text-slate-700">Status</th>
                    <th className="p-3 text-sm font-medium text-slate-700">Reported by</th>
                    <th className="p-3 text-sm font-medium text-slate-700">Date</th>
                    {canEdit && <th className="p-3 text-sm font-medium text-slate-700">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr
                      key={issue._id}
                      className="border-t border-slate-200 hover:bg-slate-50/50"
                    >
                      <td className="p-3 font-medium">
                        <Link
                          href={`/dashboard/issues/${issue._id}`}
                          className="text-primary hover:underline"
                        >
                          {issue.ticketId}
                        </Link>
                      </td>
                      <td className="p-3">
                        {issue.assetId ? (
                          <Link
                            href={`/dashboard/assets/${issue.assetId._id}`}
                            className="text-primary hover:underline text-sm"
                          >
                            {issue.assetId.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 text-slate-700 text-sm max-w-xs truncate" title={issue.title}>
                        {issue.title}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASSES[issue.status] ?? 'bg-slate-100 text-slate-700'}`}
                        >
                          {issue.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-slate-600">
                        {issue.reporterName ?? issue.reports?.[0]?.reporterName ?? '—'}
                        {issue.reports && issue.reports.length > 1 && (
                          <span className="text-slate-400"> (+{issue.reports.length - 1})</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 text-sm">
                        {new Date(issue.createdAt).toLocaleDateString()}
                      </td>
                      {canEdit && (
                        <td className="p-3">
                          <StatusButtons
                            issueId={issue._id}
                            currentStatus={issue.status}
                            onUpdate={fetchData}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {issues.length > 0 && (
          <Link
            href="/dashboard/issues"
            className="inline-block mt-3 text-primary text-sm font-medium hover:underline"
          >
            View all issues →
          </Link>
        )}
      </section>
    </div>
  );
}

function Card({ title, value, className = '' }: { title: string; value: string; className?: string }) {
  return (
    <div className={`bg-white p-5 rounded-lg border border-slate-200 ${className}`}>
      <p className="text-sm text-slate-600">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
