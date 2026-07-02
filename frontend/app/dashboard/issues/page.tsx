'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';
import { canWrite } from '@/lib/permissions';

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
  assetId?: {
    _id: string;
    name: string;
    assetId: string;
    category?: string;
    assignedTo?: { name: string; email?: string };
  };
  assignedTo?: { name: string };
};

const STATUS_BADGE: Record<string, string> = {
  open: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  in_progress: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  completed: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  cancelled: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
};

const STATUS_FILTER_ACTIVE: Record<string, string> = {
  '': 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  open: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  in_progress: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  completed: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  cancelled: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
};

const STATUS_ACCENT: Record<string, string> = {
  open: 'border-l-amber-500/50',
  in_progress: 'border-l-blue-500/50',
  completed: 'border-l-emerald-500/50',
  cancelled: 'border-l-gray-500/50',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

function SummaryCard({
  label,
  value,
  accent = 'text-gray-100',
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium text-gray-200 mt-0.5 truncate" title={value}>
        {value}
      </p>
    </div>
  );
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
    { value: 'in_progress', label: 'In progress', className: 'border-blue-500/40 bg-blue-500/10 text-blue-300' },
    { value: 'completed', label: 'Complete', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    { value: 'cancelled', label: 'Cancel', className: 'border-gray-500/40 bg-gray-500/10 text-gray-400' },
  ].filter((o) => o.value !== currentStatus);

  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setStatus(o.value)}
          disabled={loading}
          className={`${buttonClass} ${o.className} disabled:opacity-50`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function getReportCount(issue: Issue): number {
  if (issue.reports && issue.reports.length > 0) return issue.reports.length;
  return 1;
}

function IssueCard({
  issue,
  canManage,
  onUpdate,
}: {
  issue: Issue;
  canManage: boolean;
  onUpdate: () => void;
}) {
  const reporter =
    issue.reporterName ?? issue.reports?.[0]?.reporterName ?? '—';
  const reportCount = getReportCount(issue);

  return (
    <div
      className={`rounded-xl border border-gray-700/60 border-l-2 ${STATUS_ACCENT[issue.status] || 'border-l-gray-500/50'} bg-gray-800/40 px-4 py-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {canManage ? (
              <Link
                href={`/dashboard/issues/${issue._id}`}
                className="text-sm font-semibold text-blue-300 hover:text-blue-200"
              >
                {issue.ticketId}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-gray-200">{issue.ticketId}</span>
            )}
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded border capitalize ${
                STATUS_BADGE[issue.status] || STATUS_BADGE.cancelled
              }`}
            >
              {issue.status.replace('_', ' ')}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded border text-gray-400 bg-gray-500/10 border-gray-500/30 tabular-nums">
              {reportCount} {reportCount === 1 ? 'report' : 'reports'}
            </span>
          </div>
          <p className="text-xs text-gray-300 line-clamp-2">{issue.title}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Reported</p>
          <p className="text-xs text-gray-400 tabular-nums">
            {new Date(issue.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <DetailTile
          label="Asset"
          value={issue.assetId?.name ?? '—'}
        />
        <DetailTile
          label="Category"
          value={issue.category?.replace(/_/g, ' ') ?? '—'}
        />
        <DetailTile
          label="Reported by"
          value={reporter}
        />
        <DetailTile
          label="Assigned to"
          value={issue.assetId?.assignedTo?.name ?? '—'}
        />
        {issue.assetId?.assetId && (
          <DetailTile label="Asset ID" value={issue.assetId.assetId} />
        )}
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-700/40">
          <StatusButtons issueId={issue._id} currentStatus={issue.status} onUpdate={onUpdate} />
          <Link
            href={`/dashboard/issues/${issue._id}`}
            className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 ml-auto`}
          >
            View details
          </Link>
        </div>
      )}
    </div>
  );
}

type IssueStats = {
  total: number;
  open: number;
  in_progress: number;
  completed: number;
  cancelled: number;
};

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<IssueStats>({
    total: 0,
    open: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const canManage = canWrite('issues');

  useEffect(() => {
    const u = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (u) try { setUser(JSON.parse(u)); } catch (_) {}
  }, []);

  const fetchStats = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    const statuses = ['', 'open', 'in_progress', 'completed', 'cancelled'] as const;

    Promise.all(
      statuses.map((s) => {
        const q = s ? `?status=${s}&limit=1` : '?limit=1';
        return fetch(api(`/api/issues${q}`), { headers }).then((r) => r.json());
      })
    ).then((results) => {
      setStats({
        total: results[0].total || 0,
        open: results[1].total || 0,
        in_progress: results[2].total || 0,
        completed: results[3].total || 0,
        cancelled: results[4].total || 0,
      });
    }).catch(() => {});
  };

  const fetchIssues = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(page));
    params.set('limit', String(limit));
    const q = `?${params.toString()}`;

    fetch(api(`/api/issues${q}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.issues) {
          setIssues(data.issues);
          setTotal(data.total || 0);
        } else {
          setError(data.message || 'Failed to load');
        }
      })
      .catch(() => setError('Failed to load issues'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [statusFilter, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const handleUpdate = () => {
    fetchIssues();
    fetchStats();
  };

  const totalPages = Math.ceil(total / limit);
  const filterLabels: Record<string, string> = {
    '': 'All',
    open: 'Open',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Issues</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Maintenance tickets reported via QR or the report form — track status and assignees.
        </p>
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <SummaryCard label="Total" value={stats.total} accent="text-blue-300" />
          <SummaryCard label="Open" value={stats.open} accent="text-amber-300" />
          <SummaryCard label="In progress" value={stats.in_progress} accent="text-violet-300" />
          <SummaryCard label="Completed" value={stats.completed} accent="text-emerald-300" />
          <SummaryCard label="Cancelled" value={stats.cancelled} accent="text-gray-400" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(['', 'open', 'in_progress', 'completed', 'cancelled'] as const).map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              statusFilter === s
                ? STATUS_FILTER_ACTIVE[s]
                : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:bg-gray-700/60 hover:text-gray-200'
            }`}
          >
            {filterLabels[s]}
            {s === '' ? ` (${stats.total})` : ` (${stats[s as keyof IssueStats]})`}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner message="Loading issues..." />}

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && issues.length === 0 && (
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-4 py-10 text-center">
          <p className="text-sm text-gray-300">No issues found</p>
          <p className="text-xs text-gray-500 mt-1">
            {statusFilter
              ? 'Try a different filter or check back later.'
              : 'When someone reports via QR or the report form, tickets will appear here.'}
          </p>
        </div>
      )}

      {!loading && !error && issues.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {issues.map((issue) => (
              <IssueCard
                key={issue._id}
                issue={issue}
                canManage={canManage}
                onUpdate={handleUpdate}
              />
            ))}
          </div>

          {total > limit && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-1">
              <p className="text-xs text-gray-500">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 disabled:opacity-40`}
                >
                  Previous
                </button>
                <span className="px-2 text-xs text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 disabled:opacity-40`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
