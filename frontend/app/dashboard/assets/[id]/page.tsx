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
  maintenanceStartDate?: string;
  maintenanceCompletedDate?: string;
  maintenanceReason?: string;
  maintenanceHistory?: {
    startDate: string;
    endDate?: string;
    reason?: string;
    durationMinutes?: number;
    notes?: string;
  }[];
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
  retired: 'bg-slate-200 text-gray-400',
  working: 'bg-green-100 text-green-800',
  needs_repair: 'bg-red-100 text-red-800',
  out_of_service: 'bg-red-100 text-red-800',
};

const ISSUE_STATUS_CLASSES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-gray-400',
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ── Pagination & filter state ────────────────────────────────────
  const PER_PAGE = 5;

  // Maintenance history
  const [maintPage, setMaintPage] = useState(1);
  const [maintFilter, setMaintFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Issues
  const [issuesPage, setIssuesPage] = useState(1);
  const [issuesFilter, setIssuesFilter] = useState('all');

  // Usage log
  const [logsPage, setLogsPage] = useState(1);
  const [logsFilter, setLogsFilter] = useState<'all' | 'check_in' | 'check_out'>('all');

  const fetchData = (silent = false) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || !params.id) {
      setLoading(false);
      if (!params.id) setError('Invalid asset');
      else setError('Not signed in');
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);
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
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [params.id]);

  // Auto-refresh every 10 seconds to pick up maintenance status changes
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 10000);
    return () => clearInterval(interval);
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

  if (loading) return <p className="text-gray-400">Loading…</p>;
  if (error || !asset) {
    return (
      <div>
        <p className="text-red-400">{error || 'Asset not found'}</p>
        <Link href="/dashboard/assets" className="text-primary hover:underline mt-2 inline-block">
          Back to assets
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard/assets" className="inline-block mb-4 text-gray-400 hover:text-gray-100">
        ← Back to assets
      </Link>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">{asset.name}</h1>
          <p className="text-gray-400">
            {asset.assetId} · {asset.category}
            {asset.locationId?.path && ` · ${asset.locationId.path}`}
          </p>
          <span className={`inline-block mt-2 px-3 py-1.5 rounded-lg text-sm font-medium ${STATUS_CLASSES[asset.status] ?? 'bg-slate-100 text-gray-300'}`}>
            {asset.status?.replace(/_/g, ' ')}
          </span>
        </div>
        {asset.qrCodeUrl && (
          <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 shrink-0 mr-80 -mt-8">
            <img src={asset.qrCodeUrl} alt="QR" width={100} height={100} />
            <p className="text-xs text-gray-500 mt-1 text-center">Scan for details</p>
          </div>
        )}
        <div className="flex gap-2 items-start flex-wrap">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            title="Refresh asset data"
          >
            {refreshing ? '⟳ Refreshing…' : '⟳ Refresh'}
          </button>
          {typeof window !== 'undefined' && (() => {
            try {
              const u = JSON.parse(localStorage.getItem('user') || '{}');
              if (['super_admin', 'admin'].includes(u.role)) {
                return (
                  <Link href={`/dashboard/assets/${params.id}/edit`} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 no-underline">Edit</Link>
                );
              }
            } catch (_) {}
            return null;
          })()}
          {typeof window !== 'undefined' && (() => {
            try {
              const u = JSON.parse(localStorage.getItem('user') || '{}');
              if (['super_admin', 'admin'].includes(u.role)) {
                return (
                  <button type="button" onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 disabled:opacity-50">
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
                <img src={p.url} alt={p.caption || `Photo ${i + 1}`} className="h-24 w-24 object-cover rounded-lg border border-gray-700 hover:opacity-90" />
                {p.caption && <p className="text-xs text-gray-500 mt-1">{p.caption}</p>}
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
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Item label="Model" value={asset.model} />
          <Item label="Serial" value={asset.serialNumber} />
          <Item label="Assigned to" value={asset.assignedTo?.name} />
          <Item label="Location" value={asset.locationId?.path || asset.locationId?.name} />
          <Item label="Department" value={asset.departmentId?.name} />
          <div>
            <p className="text-xs text-gray-500">Purchase date</p>
            <p className="font-medium">
              {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : '—'}
              {asset.purchaseDate && (
                <span className="ml-2 text-sm text-gray-400 font-normal">
                  ({calculateAssetAge(asset.purchaseDate)} old)
                </span>
              )}
            </p>
          </div>
          <Item label="Vendor" value={asset.vendor} />
          <Item label="Cost" value={asset.cost != null ? `₹${asset.cost}` : undefined} />
          <div>
            <p className="text-xs text-gray-500">Warranty expiry</p>
            {asset.warrantyExpiry ? (
              <div className="font-medium">
                <p className={`${
                  new Date(asset.warrantyExpiry) < new Date() 
                    ? 'text-red-400' 
                    : new Date(asset.warrantyExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    ? 'text-amber-600'
                    : 'text-gray-100'
                }`}>
                  {new Date(asset.warrantyExpiry).toLocaleDateString()}
                </p>
                {new Date(asset.warrantyExpiry) < new Date() && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-400 font-medium">
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Usage log (check-in / check-out)</h2>
            <select
              value={logsFilter}
              onChange={(e) => { setLogsFilter(e.target.value as any); setLogsPage(1); }}
              className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 text-gray-300 rounded-lg focus:outline-none"
            >
              <option value="all">All types</option>
              <option value="check_in">Check-in</option>
              <option value="check_out">Check-out</option>
            </select>
          </div>
          {(() => {
            const filtered = logsFilter === 'all' ? logs : logs.filter(l => l.type === logsFilter);
            const totalPages = Math.ceil(filtered.length / PER_PAGE);
            const paginated = filtered.slice((logsPage - 1) * PER_PAGE, logsPage * PER_PAGE);
            return (
              <>
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  {paginated.length === 0 ? (
                    <p className="p-4 text-gray-400 text-sm">No log entries match the filter.</p>
                  ) : (
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-950 text-left">
                          <th className="p-3 font-medium text-gray-300">User</th>
                          <th className="p-3 font-medium text-gray-300">Type</th>
                          <th className="p-3 font-medium text-gray-300">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((log, i) => (
                          <tr key={i} className="border-t border-gray-700">
                            <td className="p-3 text-gray-100">{log.userId?.name ?? '—'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.type === 'check_in' ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>
                                {log.type === 'check_in' ? 'Check-in' : 'Check-out'}
                              </span>
                            </td>
                            <td className="p-3 text-gray-400">{new Date(log.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-500">
                      {(logsPage - 1) * PER_PAGE + 1}–{Math.min(logsPage * PER_PAGE, filtered.length)} of {filtered.length}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setLogsPage(p => Math.max(1, p - 1))} disabled={logsPage === 1}
                        className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-700">← Prev</button>
                      <span className="px-3 py-1.5 text-xs text-gray-400">Page {logsPage} / {totalPages}</span>
                      <button onClick={() => setLogsPage(p => Math.min(totalPages, p + 1))} disabled={logsPage === totalPages}
                        className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-700">Next →</button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Maintenance History</h2>
          {asset.maintenanceHistory && asset.maintenanceHistory.length > 0 && (
            <select
              value={maintFilter}
              onChange={(e) => { setMaintFilter(e.target.value as any); setMaintPage(1); }}
              className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 text-gray-300 rounded-lg focus:outline-none"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          )}
        </div>

        {/* Live banner when currently under maintenance */}
        {asset.status === 'under_maintenance' && (
          <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 mb-4 flex items-start gap-3">
            <div className="w-3 h-3 mt-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div>
              <p className="font-semibold text-amber-400">🔧 Currently Under Maintenance</p>
              {asset.maintenanceStartDate && (
                <p className="text-sm text-gray-300 mt-1">
                  Started: <span className="font-medium">{new Date(asset.maintenanceStartDate).toLocaleString()}</span>
                </p>
              )}
              {asset.maintenanceReason && (
                <p className="text-sm text-gray-400 mt-1">Reason: {asset.maintenanceReason}</p>
              )}
            </div>
          </div>
        )}

        {asset.maintenanceHistory && asset.maintenanceHistory.length > 0 ? (() => {
          const allEntries = [...asset.maintenanceHistory].reverse();
          const filtered = maintFilter === 'all' ? allEntries
            : maintFilter === 'active' ? allEntries.filter(e => !e.endDate)
            : allEntries.filter(e => !!e.endDate);
          const totalPages = Math.ceil(filtered.length / PER_PAGE);
          const paginated = filtered.slice((maintPage - 1) * PER_PAGE, maintPage * PER_PAGE);
          return (
            <>
              <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-4">
                  <span className="text-sm text-gray-400">Total times under maintenance: </span>
                  <span className="font-bold text-amber-400">{asset.maintenanceHistory.length}</span>
                  {maintFilter !== 'all' && (
                    <span className="text-xs text-gray-500">({filtered.length} {maintFilter})</span>
                  )}
                </div>
                {paginated.length === 0 ? (
                  <p className="p-4 text-gray-400 text-sm">No entries match the filter.</p>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {paginated.map((entry, i) => {
                      const start = new Date(entry.startDate);
                      const end = entry.endDate ? new Date(entry.endDate) : null;
                      const durationMins = entry.durationMinutes
                        ?? (end ? Math.round((end.getTime() - start.getTime()) / 60000) : null);
                      const durationLabel = durationMins != null
                        ? durationMins < 60 ? `${durationMins}m`
                          : durationMins < 1440 ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
                          : `${Math.floor(durationMins / 1440)}d ${Math.floor((durationMins % 1440) / 60)}h`
                        : null;
                      return (
                        <div key={i} className="p-4 flex items-start gap-3">
                          <div className="mt-1.5 shrink-0">
                            <div className={`w-2.5 h-2.5 rounded-full ${!end ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${!end ? 'bg-amber-900/30 text-amber-400' : 'bg-green-900/30 text-green-400'}`}>
                                {!end ? '🔧 Active' : '✅ Completed'}
                              </span>
                              {durationLabel && <span className="text-xs text-gray-400">⏱ {durationLabel}</span>}
                            </div>
                            <p className="text-sm text-gray-300">
                              <span className="font-medium text-gray-100">Start:</span> {start.toLocaleString()}
                            </p>
                            {end && (
                              <p className="text-sm text-gray-300">
                                <span className="font-medium text-gray-100">End:</span> {end.toLocaleString()}
                              </p>
                            )}
                            {entry.reason && (
                              <p className="text-sm text-gray-400 mt-1">
                                <span className="font-medium text-gray-300">Reason:</span> {entry.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-500">
                    {(maintPage - 1) * PER_PAGE + 1}–{Math.min(maintPage * PER_PAGE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setMaintPage(p => Math.max(1, p - 1))} disabled={maintPage === 1}
                      className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-700">← Prev</button>
                    <span className="px-3 py-1.5 text-xs text-gray-400">Page {maintPage} / {totalPages}</span>
                    <button onClick={() => setMaintPage(p => Math.min(totalPages, p + 1))} disabled={maintPage === totalPages}
                      className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-700">Next →</button>
                  </div>
                </div>
              )}
            </>
          );
        })() : (
          asset.status !== 'under_maintenance' && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
              <p className="text-2xl mb-2">🔧</p>
              <p className="text-gray-400">This asset has never been under maintenance.</p>
            </div>
          )
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Issues</h2>
          {issues.length > 0 && (
            <select
              value={issuesFilter}
              onChange={(e) => { setIssuesFilter(e.target.value); setIssuesPage(1); }}
              className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 text-gray-300 rounded-lg focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
        </div>
        {issues.length === 0 ? (
          <p className="text-gray-400">No issues reported for this asset yet.</p>
        ) : (() => {
          const filtered = issuesFilter === 'all' ? issues : issues.filter(i => i.status === issuesFilter);
          const totalPages = Math.ceil(filtered.length / PER_PAGE);
          const paginated = filtered.slice((issuesPage - 1) * PER_PAGE, issuesPage * PER_PAGE);
          return (
            <>
              {paginated.length === 0 ? (
                <p className="text-gray-400 text-sm">No issues match the selected filter.</p>
              ) : (
                <ul className="space-y-3">
                  {paginated.map((issue) => (
                    <li key={issue._id} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-medium text-gray-100">{issue.ticketId}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${ISSUE_STATUS_CLASSES[issue.status] ?? 'bg-slate-100 text-gray-300'}`}>
                          {issue.status.replace('_', ' ')}
                        </span>
                        <span className="text-gray-500 text-sm">{issue.category.replace('_', ' ')}</span>
                      </div>
                      <p className="text-gray-300 text-sm mb-1">{issue.title}</p>
                      {issue.description && (
                        <p className="text-gray-400 text-sm mb-2">{issue.description}</p>
                      )}
                      <p className="text-xs text-gray-500">
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-500">
                    {(issuesPage - 1) * PER_PAGE + 1}–{Math.min(issuesPage * PER_PAGE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setIssuesPage(p => Math.max(1, p - 1))} disabled={issuesPage === 1}
                      className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-700">← Prev</button>
                    <span className="px-3 py-1.5 text-xs text-gray-400">Page {issuesPage} / {totalPages}</span>
                    <button onClick={() => setIssuesPage(p => Math.min(totalPages, p + 1))} disabled={issuesPage === totalPages}
                      className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-700">Next →</button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium">{value ?? '—'}</p>
    </div>
  );
}
