'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';

type Asset = {
  _id: string;
  assetId: string;
  name: string;
  model?: string;
  category: string;
  serialNumber?: string;
  status: string;
  purchaseDate?: string;
  vendor?: string;
  cost?: number;
  warrantyExpiry?: string;
  amcExpiry?: string;
  nextMaintenanceDate?: string;
  locationId?: { name: string; path?: string };
  departmentId?: { name: string };
  assignedTo?: { _id: string; name: string; email: string };
  photos?: { url: string; caption?: string }[];
  documents?: { url: string; name: string }[];
  qrCodeUrl?: string;
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
  reports?: { reporterName: string; description: string; createdAt: string }[];
  createdAt: string;
  assetId?: { name: string; assetId: string };
};

const STATUS_CLASSES: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  in_use: 'bg-blue-100 text-blue-800',
  under_maintenance: 'bg-amber-100 text-amber-800',
  retired: 'bg-slate-200 text-slate-600',
  working: 'bg-green-100 text-green-800',
  needs_repair: 'bg-red-100 text-red-800',
  out_of_service: 'bg-red-100 text-red-800',
};

const ISSUE_STATUS_CLASSES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-slate-600',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function calculateAssetAge(purchaseDate: string | undefined): string {
  if (!purchaseDate) return '';

  const purchase = dayjs(purchaseDate);
  const now = dayjs();

  const years = now.diff(purchase, 'year');
  const months = now.diff(purchase, 'month') % 12;
  const days = now.diff(purchase.add(years, 'year').add(months, 'month'), 'day');

  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (days > 0 && years === 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ') : 'Less than a day';
}

export default function AssetDetailPage() {
  const params = useParams();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [logs, setLogs] = useState<{ userId: { name: string }; type: string; assignedAt?: string; unassignedAt?: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchData = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || !params.id) {
      setLoading(false);
      if (!params.id) setError('Invalid asset');
      else setError('Not signed in');
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(api(`/api/assets/${params.id}`), { headers }).then((r) => r.json()),
      fetch(api(`/api/issues?assetId=${params.id}`), { headers }).then((r) => r.json()),
      fetch(api(`/api/assets/${params.id}/logs`), { headers }).then((r) => r.json()),
    ])
      .then(([assetData, issuesData, logsData]) => {
        if (assetData._id) setAsset(assetData);
        else setError(assetData.message || 'Not found');
        if (issuesData.issues) setIssues(issuesData.issues);
        if (logsData.logs) setLogs(logsData.logs);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm('Delete this asset? This cannot be undone.')) return;
    const token = localStorage.getItem('token');
    if (!token || !params.id) return;
    setDeleting(true);
    try {
      const res = await fetch(api(`/api/assets/${params.id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) window.location.href = '/dashboard/assets';
      else setError((await res.json()).message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-slate-600">Loading…</p>;
  if (error || !asset) {
    return (
      <div>
        <p className="text-red-600">{error || 'Asset not found'}</p>
        <Link href="/dashboard/assets" className="text-primary hover:underline mt-2 inline-block">
          Back to assets
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard/assets" className="inline-block mb-4 text-slate-600 hover:text-slate-900">
        ← Back to assets
      </Link>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">{asset.name}</h1>
          <p className="text-slate-600">
            {asset.assetId} · {asset.category}
            {asset.locationId?.path && ` · ${asset.locationId.path}`}
          </p>
          <span
            className={`inline-block mt-2 px-3 py-1.5 rounded-lg text-sm font-medium ${STATUS_CLASSES[asset.status] ?? 'bg-slate-100 text-slate-700'}`}
          >
            {asset.status?.replace('_', ' ')}
          </span>
        </div>
        {asset.qrCodeUrl && (
          <div className="p-3 bg-white rounded-lg border border-slate-200 shrink-0">
            <img src={asset.qrCodeUrl} alt="QR" width={80} height={80} />
            <p className="text-xs text-slate-500 mt-1">Scan for details</p>
          </div>
        )}
        <div className="flex gap-2">
          {typeof window !== 'undefined' && (() => {
            try {
              const u = JSON.parse(localStorage.getItem('user') || '{}');
              if (['super_admin', 'admin', 'manager'].includes(u.role)) {
                return (
                  <Link href={`/dashboard/assets/${params.id}/edit`} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">Edit</Link>
                );
              }
            } catch (_) {}
            return null;
          })()}
          {typeof window !== 'undefined' && (() => {
            try {
              const u = JSON.parse(localStorage.getItem('user') || '{}');
              if (['super_admin', 'admin', 'manager'].includes(u.role)) {
                return (
                  <button type="button" onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50">
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                );
              }
            } catch (_) {}
            return null;
          })()}
        </div>
      </div>

      {(asset.photos?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Photos</h2>
          <div className="flex flex-wrap gap-3">
            {asset.photos!.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={p.url} alt={p.caption || `Photo ${i + 1}`} className="h-24 w-24 object-cover rounded-lg border border-slate-200 hover:opacity-90" />
                {p.caption && <p className="text-xs text-slate-500 mt-1">{p.caption}</p>}
              </a>
            ))}
          </div>
        </section>
      )}

      {(asset.documents?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Documents</h2>
          <ul className="space-y-2">
            {asset.documents!.map((d, i) => (
              <li key={i}>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {d.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Details</h2>
        <div className="bg-white p-6 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Item label="Model" value={asset.model} />
          <Item label="Serial" value={asset.serialNumber} />
          <Item label="Assigned to" value={asset.assignedTo?.name} />
          <Item label="Location" value={asset.locationId?.path || asset.locationId?.name} />
          <Item label="Department" value={asset.departmentId?.name} />
          <div>
            <p className="text-xs text-slate-500">Purchase date</p>
            <p className="font-medium">
              {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : '—'}
              {asset.purchaseDate && (
                <span className="ml-2 text-sm text-slate-600 font-normal">
                  ({calculateAssetAge(asset.purchaseDate)} old)
                </span>
              )}
            </p>
          </div>
          <Item label="Vendor" value={asset.vendor} />
          <Item label="Cost" value={asset.cost != null ? `₹${asset.cost}` : undefined} />
          <div>
            <p className="text-xs text-slate-500">Warranty expiry</p>
            {asset.warrantyExpiry ? (
              <div className="font-medium">
                <p className={`${
                  new Date(asset.warrantyExpiry) < new Date() 
                    ? 'text-red-600' 
                    : new Date(asset.warrantyExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    ? 'text-amber-600'
                    : 'text-slate-900'
                }`}>
                  {new Date(asset.warrantyExpiry).toLocaleDateString()}
                </p>
                {new Date(asset.warrantyExpiry) < new Date() && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">
                    Expired
                  </span>
                )}
                {new Date(asset.warrantyExpiry) >= new Date() &&
                 new Date(asset.warrantyExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-medium">
                    Expiring soon
                  </span>
                )}
              </div>
            ) : (
              <p className="font-medium">—</p>
            )}
          </div>
          <Item label="AMC expiry" value={asset.amcExpiry ? new Date(asset.amcExpiry).toLocaleDateString() : undefined} />
          <Item label="Next maintenance" value={asset.nextMaintenanceDate ? new Date(asset.nextMaintenanceDate).toLocaleDateString() : undefined} />
        </div>
      </section>

      {logs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Usage log (check-in / check-out)</h2>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="p-3 font-medium text-slate-700">User</th>
                  <th className="p-3 font-medium text-slate-700">Type</th>
                  <th className="p-3 font-medium text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="p-3">{log.userId?.name ?? '—'}</td>
                    <td className="p-3">{log.type === 'check_in' ? 'Check-in' : 'Check-out'}</td>
                    <td className="p-3 text-slate-600">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Issues</h2>
        {issues.length === 0 ? (
          <p className="text-slate-600">No issues reported for this asset yet.</p>
        ) : (
          <ul className="space-y-3">
            {issues.map((issue) => (
              <li
                key={issue._id}
                className="bg-white rounded-lg border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-medium">{issue.ticketId}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${ISSUE_STATUS_CLASSES[issue.status] ?? 'bg-slate-100 text-slate-700'}`}
                  >
                    {issue.status.replace('_', ' ')}
                  </span>
                  <span className="text-slate-500 text-sm">
                    {issue.category.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-slate-700 text-sm mb-1">{issue.title}</p>
                {issue.description && (
                  <p className="text-slate-600 text-sm mb-2">{issue.description}</p>
                )}
                <p className="text-xs text-slate-500">
                  {issue.reporterName ?? issue.reports?.[0]?.reporterName}
                  {issue.reports && issue.reports.length > 1 && (
                    <> · +{issue.reports.length - 1} more report(s)</>
                  )}
                  {' · '}
                  {new Date(issue.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium">{value ?? '—'}</p>
    </div>
  );
}
