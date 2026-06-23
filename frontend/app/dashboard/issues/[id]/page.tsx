'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

type ReportRow = {
  reporterName: string;
  reporterEmail?: string;
  reporterPhone?: string;
  description: string;
  createdAt: string;
};

type Issue = {
  _id: string;
  ticketId: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  reports?: ReportRow[];
  createdAt: string;
  assetId?: {
    _id: string;
    name: string;
    assetId: string;
    category?: string;
    assignedTo?: { name: string; email?: string };
  };
  assignedTo?: { name: string; email?: string };
};

const STATUS_BADGE: Record<string, string> = {
  open: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  in_progress: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  completed: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  cancelled: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium text-gray-200 mt-0.5 break-words">{value}</p>
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

export default function IssueDetailPage() {
  const params = useParams();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchIssue = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || !params.id) {
      setLoading(false);
      if (!params.id) setError('Invalid issue');
      else setError('Not signed in');
      return;
    }
    fetch(api(`/api/issues/${params.id}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data._id) setIssue(data);
        else setError(data.message || 'Not found');
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIssue();
  }, [params.id]);

  if (loading) return <LoadingSpinner message="Loading issue..." />;

  if (error || !issue) {
    return (
      <div className="max-w-7xl mx-auto">
        <p className="text-red-400">{error || 'Issue not found'}</p>
        <Link
          href="/dashboard/issues"
          className={`${buttonClass} inline-block mt-3 border-gray-700/60 text-gray-400 hover:text-gray-200`}
        >
          Back to issues
        </Link>
      </div>
    );
  }

  const reportRows: ReportRow[] =
    issue.reports && issue.reports.length > 0
      ? issue.reports.map((r) => ({
          reporterName: r.reporterName,
          reporterEmail: r.reporterEmail,
          reporterPhone: r.reporterPhone,
          description: r.description,
          createdAt: r.createdAt,
        }))
      : [
          {
            reporterName: issue.reporterName ?? '—',
            reporterEmail: issue.reporterEmail,
            reporterPhone: issue.reporterPhone,
            description: issue.description ?? '—',
            createdAt: issue.createdAt,
          },
        ];

  return (
    <div className="max-w-7xl mx-auto">
      <Link
        href="/dashboard/issues"
        className={`${buttonClass} inline-block mb-4 border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
      >
        Back to issues
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-100">{issue.ticketId}</h1>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded border capitalize ${
                STATUS_BADGE[issue.status] || STATUS_BADGE.cancelled
              }`}
            >
              {issue.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-300">{issue.title}</p>
        </div>
        <StatusButtons
          issueId={issue._id}
          currentStatus={issue.status}
          onUpdate={fetchIssue}
        />
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-3">Issue details</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <DetailTile label="Category" value={issue.category.replace(/_/g, ' ')} />
          <DetailTile
            label="Reported"
            value={new Date(issue.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          />
          {issue.assignedTo && (
            <DetailTile label="Assigned to" value={issue.assignedTo.name} />
          )}
        </div>
      </div>

      {issue.assetId && (
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gray-800/40 px-4 py-4 mb-4">
          <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest mb-3">Linked asset</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <DetailTile label="Asset name" value={issue.assetId.name} />
            <DetailTile label="Asset ID" value={issue.assetId.assetId} />
            {issue.assetId.category && (
              <DetailTile label="Category" value={issue.assetId.category} />
            )}
            {issue.assetId.assignedTo && (
              <DetailTile label="Assigned to" value={issue.assetId.assignedTo.name} />
            )}
            {issue.assetId.assignedTo?.email && (
              <DetailTile label="Assignee email" value={issue.assetId.assignedTo.email} />
            )}
          </div>
          <Link
            href={`/dashboard/assets/${issue.assetId._id}`}
            className={`${buttonClass} inline-block mt-3 border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20`}
          >
            View asset
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-amber-500/50 bg-gray-800/40 overflow-hidden">
        <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest px-4 py-3 border-b border-gray-700/60">
          Reports in this ticket ({reportRows.length})
        </p>

        {reportRows.length === 0 ? (
          <p className="px-4 py-6 text-xs text-gray-500">No reports recorded.</p>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {reportRows.map((r, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="mb-4 flex items-center gap-3" aria-hidden>
                    <div className="flex-1 border-t border-dashed border-gray-600/70" />
                    <span className="text-[10px] font-medium text-gray-600 uppercase tracking-widest shrink-0">
                      Next report
                    </span>
                    <div className="flex-1 border-t border-dashed border-gray-600/70" />
                  </div>
                )}
                <div className="rounded-lg border border-amber-500/20 bg-gray-900/40 px-3 py-3">
                  <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-widest mb-3">
                    Report {i + 1} of {reportRows.length}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <DetailTile label="Name" value={r.reporterName} />
                    <DetailTile label="Email" value={r.reporterEmail ?? '—'} />
                    <DetailTile label="Phone" value={r.reporterPhone ?? '—'} />
                    <DetailTile
                      label="Reported at"
                      value={new Date(r.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    />
                  </div>
                  <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Description</p>
                    <p className="text-xs text-gray-300 whitespace-pre-wrap">{r.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
