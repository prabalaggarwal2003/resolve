'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Issue = {
  _id: string;
  ticketId: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  reporterName?: string;
  reporterEmail?: string;
  reports?: { reporterName: string }[];
  createdAt: string;
  assetId?: { _id: string; name: string; assetId: string; category?: string; assignedTo?: { name: string; email?: string } };
  assignedTo?: { name: string };
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

  if (options.length === 0) return <span className="text-slate-400 text-sm">—</span>;

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

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [myReportsOnly, setMyReportsOnly] = useState(false);
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  useEffect(() => {
    const u = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (u) try { setUser(JSON.parse(u)); } catch (_) {}
  }, []);

  const fetchIssues = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (myReportsOnly) params.set('myReports', 'true');
    params.set('page', String(page));
    params.set('limit', String(limit));
    const q = params.toString() ? `?${params.toString()}` : '';
    fetch(api(`/api/issues${q}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.issues) {
          setIssues(data.issues);
          setTotal(data.total || 0);
        }
        else setError(data.message || 'Failed to load');
      })
      .catch(() => setError('Failed to load issues'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIssues();
  }, [statusFilter, myReportsOnly, page, limit]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, myReportsOnly]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Issues</h1>
      <p className="text-slate-600 mb-6">
        Open, in progress, and completed — reported via QR scan or from asset pages
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm font-medium text-slate-700">Filter:</span>
        {user?.role === 'reporter' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={myReportsOnly} onChange={(e) => setMyReportsOnly(e.target.checked)} className="rounded" />
            <span className="text-sm text-slate-700">My reports only</span>
          </label>
        )}
        {['', 'open', 'in_progress', 'completed', 'cancelled'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              statusFilter === s
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-600">Loading…</p>}
      {error && (
        <p className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
      )}

      {!loading && !error && issues.length === 0 && (
        <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-slate-600">
          No issues yet. When someone reports via QR or the report form, tickets will appear here.
        </div>
      )}

      {!loading && !error && issues.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="p-3 text-sm font-medium text-slate-700">Ticket</th>
                  <th className="p-3 text-sm font-medium text-slate-700">Asset</th>
                  <th className="p-3 text-sm font-medium text-slate-700">Title</th>
                  <th className="p-3 text-sm font-medium text-slate-700">Status</th>
                  <th className="p-3 text-sm font-medium text-slate-700">Category</th>
                  <th className="p-3 text-sm font-medium text-slate-700">Reported by</th>
                  <th className="p-3 text-sm font-medium text-slate-700">Assigned to (asset)</th>
                  <th className="p-3 text-sm font-medium text-slate-700">Date</th>
                  <th className="p-3 text-sm font-medium text-slate-700">Actions</th>
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
                          className="text-primary hover:underline"
                        >
                          {issue.assetId.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-slate-700 max-w-xs truncate" title={issue.title}>
                      {issue.title}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASSES[issue.status] ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {issue.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 text-sm">
                      {issue.category?.replace('_', ' ') ?? '—'}
                    </td>
                    <td className="p-3 text-sm">
                      {issue.reporterName ?? issue.reports?.[0]?.reporterName ?? '—'}
                      {issue.reports && issue.reports.length > 1 && (
                        <span className="text-slate-500"> (+{issue.reports.length - 1})</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 text-sm">
                      {issue.assetId?.assignedTo?.name ?? '—'}
                    </td>
                    <td className="p-3 text-slate-600 text-sm">
                      {new Date(issue.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusButtons
                          issueId={issue._id}
                          currentStatus={issue.status}
                          onUpdate={fetchIssues}
                        />
                        <Link
                          href={`/dashboard/issues/${issue._id}`}
                          className="text-primary text-sm hover:underline"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} issues
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm">
                  Page {page} of {Math.ceil(total / limit)}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                  disabled={page >= Math.ceil(total / limit)}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
