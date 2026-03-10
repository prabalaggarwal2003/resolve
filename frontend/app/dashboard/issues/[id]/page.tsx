'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  assetId?: { _id: string; name: string; assetId: string; category?: string; assignedTo?: { name: string; email?: string } };
  assignedTo?: { name: string; email?: string };
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

  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setStatus(o.value)}
          disabled={loading}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-500 disabled:opacity-50"
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

  if (loading) return <p className="text-gray-400">Loading…</p>;
  if (error || !issue) {
    return (
      <div>
        <p className="text-red-400">{error || 'Issue not found'}</p>
        <Link href="/dashboard/issues" className="text-primary hover:underline mt-2 inline-block">
          Back to issues
        </Link>
      </div>
    );
  }

  // Build table rows: use reports[] if present; else one row from main issue fields
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
    <div>
      <Link href="/dashboard/issues" className="inline-block mb-4 text-gray-400 hover:text-gray-100">
        ← Back to issues
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{issue.ticketId}</h1>
          <span
            className={`px-3 py-1 rounded-lg text-sm font-medium ${STATUS_CLASSES[issue.status] ?? 'bg-slate-100 text-gray-300'}`}
          >
            {issue.status.replace('_', ' ')}
          </span>
            <span className="text-gray-500 text-md ml-4">Category: {issue.category.replace('_', ' ')}</span>
        </div>
        <StatusButtons
          issueId={issue._id}
          currentStatus={issue.status}
          onUpdate={fetchIssue}
        />
      </div>

      {issue.assetId && (
        <div className="mb-4 space-y-1">
          <p className="text-gray-400">
            Asset:{' '}
            <Link
              href={`/dashboard/assets/${issue.assetId._id}`}
              className="text-primary hover:underline font-medium"
            >
              {issue.assetId.name}
            </Link>
          </p>
          {issue.assetId.assignedTo && (
            <p className="text-gray-400 text-sm">
              Asset assigned to: <strong>{issue.assetId.assignedTo.name}</strong>
              {issue.assetId.assignedTo.email && (
                <span className="text-gray-500"> ({issue.assetId.assignedTo.email})</span>
              )}
            </p>
          )}
        </div>
      )}
      {/*<p className="text-gray-300 mb-6">{issue.title}</p>*/}
      {/*{issue.description && issue.reports?.length === 0 && (*/}
      {/*  <p className="text-gray-400 mb-6 whitespace-pre-wrap">{issue.description}</p>*/}
      {/*)}*/}

      <section className="mb-6 mt-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Reports in this ticket
        </h2>
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-950 text-left">
                  <th className="p-3 text-sm font-medium text-gray-300">Name</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Email</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Phone</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Description</th>
                  <th className="p-3 text-sm font-medium text-gray-300">Reported at</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-700">
                    <td className="p-3 font-medium text-gray-300">{r.reporterName}</td>
                    <td className="p-3 text-gray-400 text-sm">{r.reporterEmail ?? '—'}</td>
                    <td className="p-3 text-gray-400 text-sm">{r.reporterPhone ?? '—'}</td>
                    <td className="p-3 text-gray-300 text-sm max-w-md">{r.description}</td>
                    <td className="p-3 text-gray-500 text-sm whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {issue.assignedTo && (
        <p className="text-gray-400 text-sm">
          Assigned to <strong>{issue.assignedTo.name}</strong>
        </p>
      )}
    </div>
  );
}
