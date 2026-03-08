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
  cancelled: 'bg-slate-200 text-gray-400',
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
          className="px-2 py-1 text-xs font-medium rounded bg-slate-100 text-gray-300 hover:bg-slate-200 disabled:opacity-50"
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
  }, [statusFilter, page, limit]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 text-gray-100">Issues</h1>
      <p className="text-gray-400 mb-6">
        Open, in progress, and completed — reported via QR scan or from asset pages
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm font-medium text-gray-300">Filter:</span>
        {['', 'open', 'in_progress', 'completed', 'cancelled'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              statusFilter === s
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-gray-300 hover:bg-slate-200'
            }`}
          >
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400">Loading…</p>}
      {error && (
        <p className="p-4 bg-red-900/20 border border-red-800 text-red-400 rounded-lg text-sm">{error}</p>
      )}

      {!loading && !error && issues.length === 0 && (
        <div className="bg-gray-800 p-12 rounded-lg border border-gray-700 text-center text-gray-400">
          No issues yet. When someone reports via QR or the report form, tickets will appear here.
        </div>
      )}

      {!loading && !error && issues.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-950 text-left">
                  <th className="p-3 text-sm font-medium text-gray-300">Ticket</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Asset</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Title</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Status</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Category</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Reported by</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Assigned to (asset)</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Date</th>
                  {user?.role !== 'manager' && (
                    <th className="p-3 text-sm font-medium text-gray-300">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr
                    key={issue._id}
                    className="border-t border-gray-700 hover:bg-gray-950/50"
                  >
                    <td className="p-3 font-medium text-gray-100">
                      {user?.role !== 'manager' ? (
                        <Link
                          href={`/dashboard/issues/${issue._id}`}
                          className="text-primary hover:underline"
                        >
                          {issue.ticketId}
                        </Link>
                      ) : (
                        <span>{issue.ticketId}</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-100">
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
                    <td className="p-3 text-gray-300 max-w-xs truncate" title={issue.title}>
                      {issue.title}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASSES[issue.status] ?? 'bg-slate-100 text-gray-300'}`}
                      >
                        {issue.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400 text-sm">
                      {issue.category?.replace('_', ' ') ?? '—'}
                    </td>
                    <td className="p-3 text-sm text-gray-100">
                      {issue.reporterName ?? issue.reports?.[0]?.reporterName ?? '—'}
                      {issue.reports && issue.reports.length > 1 && (
                        <span className="text-gray-500"> (+{issue.reports.length - 1})</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-400 text-sm">
                      {issue.assetId?.assignedTo?.name ?? '—'}
                    </td>
                    <td className="p-3 text-gray-400 text-sm">
                      {new Date(issue.createdAt).toLocaleDateString()}
                    </td>
                    {user?.role !== 'manager' && (
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
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="p-4 border-t border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} issues
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-slate-300 text-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-950"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-100">
                  Page {page} of {Math.ceil(total / limit)}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                  disabled={page >= Math.ceil(total / limit)}
                  className="px-3 py-1.5 text-sm border border-slate-300 text-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-950"
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
