'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';
import { canWrite } from '@/lib/permissions';
import AssetFieldsDisplay from '@/components/AssetFieldsDisplay';
import { breadcrumbForNode } from '@/lib/locations';

type TimelineEntry = {
  _id: string;
  type: 'edit' | 'created' | 'note' | 'maintenance' | 'check_in' | 'check_out';
  createdAt: string;
  user?: { _id: string; name: string; email: string } | null;
  summary?: string;
  changeReason?: string | null;
  noteText?: string | null;
  notes?: string | null;
  fieldChanges?: { field: string; label: string; oldValue: string; newValue: string }[];
};

const TIMELINE_TYPE_META: Record<string, { label: string; dot: string; title: string }> = {
  created: { label: 'Created', dot: 'bg-emerald-400', title: 'text-emerald-300' },
  edit: { label: 'Updated', dot: 'bg-blue-400', title: 'text-blue-300' },
  note: { label: 'Note', dot: 'bg-violet-400', title: 'text-violet-300' },
  maintenance: { label: 'Maintenance', dot: 'bg-amber-400', title: 'text-amber-300' },
  check_in: { label: 'Check-in', dot: 'bg-teal-400', title: 'text-teal-300' },
  check_out: { label: 'Check-out', dot: 'bg-orange-400', title: 'text-orange-300' },
};

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
  assignedToName?: string;
  assignedToEmployeeCode?: string;
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
  vendorId?: { _id: string; name: string; vendorId?: string };
  assignedTo?: { _id: string; name: string; email: string };
  tags?: string[];
  customFields?: Record<string, unknown>;
  condition?: string;
  lastHealthCheck?: string;
  assignedAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
};

const STATUS_BADGE: Record<string, string> = {
  available: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  in_use: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  under_maintenance: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  retired: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
  working: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  needs_repair: 'text-red-300 bg-red-500/15 border-red-500/30',
  out_of_service: 'text-red-300 bg-red-500/15 border-red-500/30',
};

const ISSUE_STATUS_BADGE: Record<string, string> = {
  open: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  in_progress: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  completed: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  cancelled: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
};

const selectClass =
  'px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-300 focus:ring-1 focus:ring-blue-500/40 shrink-0';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function Section({
  title,
  subtitle,
  accentClass,
  titleClass,
  children,
  headerRight,
  compact,
  className = 'mb-4',
}: {
  title: string;
  subtitle?: string;
  accentClass: string;
  titleClass: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div className={`rounded-xl border border-gray-700/60 border-l-2 ${accentClass} bg-gray-800/40 px-3 py-2.5 ${className}`}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-baseline gap-2 min-w-0">
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${titleClass}`}>{title}</p>
            {subtitle && <span className="text-[10px] text-gray-500 truncate">{subtitle}</span>}
          </div>
          {headerRight}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-700/60 border-l-2 ${accentClass} bg-gray-800/40 px-4 py-4 ${className}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest ${titleClass}`}>{title}</p>
      {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  perPage,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-1.5 mt-1.5 pt-1.5 border-t border-gray-700/30">
      <span className="text-[10px] text-gray-500 mr-auto">
        {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
      </span>
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 disabled:opacity-40`}
      >
        Prev
      </button>
      <span className="text-[10px] text-gray-500">{page}/{totalPages}</span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 disabled:opacity-40`}
      >
        Next
      </button>
    </div>
  );
}

function getReportCount(issue: Issue): number {
  if (issue.reports && issue.reports.length > 0) return issue.reports.length;
  return 1;
}

export default function AssetDetailPage() {
  const params = useParams();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [canAdmin, setCanAdmin] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');

  const PER_PAGE = 5;
  const [maintPage, setMaintPage] = useState(1);
  const [maintFilter, setMaintFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [issuesPage, setIssuesPage] = useState(1);
  const [issuesFilter, setIssuesFilter] = useState('all');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setCanAdmin(canWrite('assets'));
    } catch (_) {}
  }, []);

  const fetchData = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || !params.id) {
      setLoading(false);
      if (!params.id) setError('Invalid asset');
      else setError('Not signed in');
      return;
    }
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(api(`/api/assets/${params.id}`), { headers }).then((r) => r.json()),
      fetch(api(`/api/assets/${params.id}/timeline`), { headers }).then((r) => r.json()),
      fetch(api(`/api/issues?assetId=${params.id}`), { headers }).then((r) => r.json()),
    ])
      .then(([assetData, timelineData, issuesData]) => {
        if (assetData._id) setAsset(assetData);
        else setError(assetData.message || 'Not found');
        if (timelineData.timeline) setTimeline(timelineData.timeline);
        if (issuesData.issues) setIssues(issuesData.issues);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const handleAddNote = async () => {
    const text = noteText.trim();
    if (!text || !params.id) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setNoteSaving(true);
    setNoteError('');
    try {
      const res = await fetch(api(`/api/assets/${params.id}/notes`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add note');
      if (data.entry) setTimeline((prev) => [data.entry, ...prev]);
      setNoteText('');
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this asset? This cannot be undone.')) return;
    const token = localStorage.getItem('token');
    if (!token || !params.id) return;
    setDeleting(true);
    try {
      const res = await fetch(api(`/api/assets/${params.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) window.location.href = '/dashboard/assets';
      else setError((await res.json()).message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading asset..." />;

  if (error || !asset) {
    return (
      <div className="max-w-7xl mx-auto">
        <p className="text-red-400">{error || 'Asset not found'}</p>
        <Link href="/dashboard/assets" className={`${buttonClass} inline-block mt-3 border-gray-700/60 text-gray-400`}>
          Back to assets
        </Link>
      </div>
    );
  }

  const warrantyExpired = asset.warrantyExpiry ? new Date(asset.warrantyExpiry) < new Date() : false;
  const warrantySoon =
    asset.warrantyExpiry &&
    !warrantyExpired &&
    new Date(asset.warrantyExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const allMaintEntries = asset.maintenanceHistory ? [...asset.maintenanceHistory].reverse() : [];
  const filteredMaint =
    maintFilter === 'all'
      ? allMaintEntries
      : maintFilter === 'active'
      ? allMaintEntries.filter((e) => !e.endDate)
      : allMaintEntries.filter((e) => !!e.endDate);
  const maintTotalPages = Math.ceil(filteredMaint.length / PER_PAGE);
  const paginatedMaint = filteredMaint.slice((maintPage - 1) * PER_PAGE, maintPage * PER_PAGE);

  const filteredIssues = issuesFilter === 'all' ? issues : issues.filter((i) => i.status === issuesFilter);
  const issuesTotalPages = Math.ceil(filteredIssues.length / PER_PAGE);
  const paginatedIssues = filteredIssues.slice((issuesPage - 1) * PER_PAGE, issuesPage * PER_PAGE);
  const noteEntries = timeline.filter((e) => e.type === 'note');

  return (
    <div className="max-w-7xl mx-auto">
      <Link
        href="/dashboard/assets"
        className={`${buttonClass} inline-block mb-4 border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
      >
        Back to assets
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-100">{asset.name}</h1>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded border capitalize ${
                STATUS_BADGE[asset.status] || STATUS_BADGE.retired
              }`}
            >
              {asset.status?.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-400 font-mono">{asset.assetId}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {asset.category}
            {asset.locationId
              ? ` · ${breadcrumbForNode(asset.locationId)}`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-3 shrink-0">
          {asset.qrCodeUrl && (
            <div className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-gray-700/60 bg-gray-900/40 text-center shrink-0">
              <img
                src={asset.qrCodeUrl}
                alt="QR code"
                className="mx-auto w-14 h-14 sm:w-[88px] sm:h-[88px]"
              />
              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">Scan for details</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {canAdmin && (
              <Link
                href={`/dashboard/assets/${params.id}/edit`}
                className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 no-underline`}
              >
                Edit
              </Link>
            )}
            {canAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={`${buttonClass} border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50`}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {asset.status === 'under_maintenance' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 mb-4 flex items-start gap-3">
          <div className="w-2 h-2 mt-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Currently under maintenance</p>
            {asset.maintenanceStartDate && (
              <p className="text-xs text-gray-400 mt-1">
                Started {new Date(asset.maintenanceStartDate).toLocaleString('en-IN')}
              </p>
            )}
            {asset.maintenanceReason && (
              <p className="text-xs text-gray-500 mt-0.5">Reason: {asset.maintenanceReason}</p>
            )}
          </div>
        </div>
      )}

      <AssetFieldsDisplay
        asset={asset as Record<string, unknown>}
        warrantyAccent={warrantyExpired ? 'text-red-300' : warrantySoon ? 'text-amber-300' : undefined}
        warrantyBadge={
          warrantyExpired ? (
            <span className="px-1 py-0.5 text-[9px] font-medium rounded border text-red-300 bg-red-500/15 border-red-500/30">
              Expired
            </span>
          ) : warrantySoon ? (
            <span className="px-1 py-0.5 text-[9px] font-medium rounded border text-amber-300 bg-amber-500/15 border-amber-500/30">
              Expiring soon
            </span>
          ) : undefined
        }
      />

      <Section title="Notes" subtitle="Short context that does not fit elsewhere" accentClass="border-l-violet-500/50" titleClass="text-violet-400/80" compact>
        {canAdmin && (
          <div className="mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
                placeholder="Add a note…"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-violet-500/40"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={noteSaving || !noteText.trim()}
                className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 disabled:opacity-50 shrink-0`}
              >
                {noteSaving ? 'Adding…' : 'Add'}
              </button>
            </div>
            {noteError && <p className="text-[11px] text-red-400 mt-1">{noteError}</p>}
          </div>
        )}
        {noteEntries.length === 0 ? (
          <p className="text-[11px] text-gray-500 py-1">No notes yet.</p>
        ) : (
          <div className="space-y-2">
            {noteEntries.slice(0, 8).map((entry) => (
              <div key={entry._id} className="rounded-lg border border-gray-700/40 bg-gray-900/30 px-3 py-2">
                <p className="text-xs text-gray-200">{entry.noteText || entry.notes}</p>
                <p className="text-[10px] text-gray-500 mt-1">
                  {entry.user?.name || 'Unknown'}
                  {' · '}
                  {new Date(entry.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Timeline"
        subtitle={timeline.length ? `${timeline.length} events` : 'No history yet'}
        accentClass="border-l-sky-500/50"
        titleClass="text-sky-400/80"
        compact
      >
        {timeline.length === 0 ? (
          <p className="text-[11px] text-gray-500 py-1">Activity will appear here as changes are made.</p>
        ) : (
          <div className="relative pl-4 border-l border-gray-700/40 space-y-4">
            {timeline.map((entry) => {
              const meta = TIMELINE_TYPE_META[entry.type] || TIMELINE_TYPE_META.edit;
              return (
                <div key={entry._id} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={`text-[11px] font-semibold uppercase tracking-wide ${meta.title}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-gray-500 tabular-nums">
                        {new Date(entry.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {entry.user?.name && (
                        <span className="text-[10px] text-gray-500">by {entry.user.name}</span>
                      )}
                    </div>

                    {entry.type === 'note' && (
                      <p className="text-xs text-gray-300 mt-1">{entry.noteText || entry.notes}</p>
                    )}

                    {entry.type === 'maintenance' && (
                      <p className="text-xs text-gray-300 mt-1">{entry.summary}{entry.notes ? ` — ${entry.notes}` : ''}</p>
                    )}

                    {entry.type === 'created' && (
                      <p className="text-xs text-gray-300 mt-1">{entry.summary || 'Asset created'}</p>
                    )}

                    {entry.type === 'edit' && (
                      <div className="mt-1 space-y-1">
                        {entry.fieldChanges?.map((c, i) => (
                          <p key={`${c.field}-${i}`} className="text-xs text-gray-400">
                            <span className="text-gray-500">{c.label}:</span>{' '}
                            <span>{c.oldValue}</span>
                            <span className="text-gray-600 mx-1">→</span>
                            <span className="text-gray-200">{c.newValue}</span>
                          </p>
                        ))}
                        {!entry.fieldChanges?.length && entry.summary && (
                          <p className="text-xs text-gray-400">{entry.summary}</p>
                        )}
                        {entry.changeReason && (
                          <p className="text-xs text-amber-300/90 mt-1.5 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1">
                            <span className="text-amber-500/80 text-[10px] uppercase tracking-wide">Reason · </span>
                            {entry.changeReason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {(asset.photos?.length ?? 0) > 0 && (
        <Section title="Photos" accentClass="border-l-violet-500/50" titleClass="text-violet-400/80">
          <div className="flex flex-wrap gap-3">
            {asset.photos!.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={p.url}
                  alt={p.caption || `Photo ${i + 1}`}
                  className="h-20 w-20 object-cover rounded-lg border border-gray-700/60 hover:opacity-90"
                />
                {p.caption && <p className="text-[10px] text-gray-500 mt-1 max-w-[80px] truncate">{p.caption}</p>}
              </a>
            ))}
          </div>
        </Section>
      )}

      {(asset.documents?.length ?? 0) > 0 && (
        <Section title="Documents" accentClass="border-l-teal-500/50" titleClass="text-teal-400/80">
          <div className="space-y-2">
            {asset.documents!.map((d, i) => (
              <a
                key={i}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonClass} inline-block border-teal-500/30 bg-teal-500/5 text-teal-300 hover:bg-teal-500/15`}
              >
                {d.name}
              </a>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Maintenance"
        subtitle={
          asset.maintenanceHistory?.length
            ? `${asset.maintenanceHistory.length} entries`
            : 'No history'
        }
        accentClass="border-l-amber-500/50"
        titleClass="text-amber-400/80"
        compact
        headerRight={
          asset.maintenanceHistory && asset.maintenanceHistory.length > 0 ? (
            <select
              value={maintFilter}
              onChange={(e) => {
                setMaintFilter(e.target.value as 'all' | 'active' | 'completed');
                setMaintPage(1);
              }}
              className={selectClass}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Done</option>
            </select>
          ) : undefined
        }
      >
        {paginatedMaint.length === 0 ? (
          <p className="text-[11px] text-gray-500 py-1">
            {asset.status !== 'under_maintenance' ? 'No maintenance recorded.' : 'No matching entries.'}
          </p>
        ) : (
          <div className="divide-y divide-gray-700/30">
            {paginatedMaint.map((entry, i) => {
              const start = new Date(entry.startDate);
              const end = entry.endDate ? new Date(entry.endDate) : null;
              const durationMins =
                entry.durationMinutes ??
                (end ? Math.round((end.getTime() - start.getTime()) / 60000) : null);
              const durationLabel =
                durationMins != null
                  ? durationMins < 60
                    ? `${durationMins}m`
                    : durationMins < 1440
                    ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
                    : `${Math.floor(durationMins / 1440)}d`
                  : null;

              return (
                <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 text-xs min-w-0">
                  <span
                    className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border ${
                      !end
                        ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
                        : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                    }`}
                  >
                    {!end ? 'Active' : 'Done'}
                  </span>
                  <span className="text-gray-400 shrink-0 tabular-nums">
                    {start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {end ? ` → ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                  </span>
                  {durationLabel && <span className="text-gray-500 shrink-0">{durationLabel}</span>}
                  {entry.reason && (
                    <span className="text-gray-500 truncate min-w-0 flex-1">{entry.reason}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Pagination
          page={maintPage}
          totalPages={maintTotalPages}
          total={filteredMaint.length}
          perPage={PER_PAGE}
          onPageChange={setMaintPage}
        />
      </Section>

      <Section
        title="Issues"
        subtitle={issues.length ? `${issues.length} tickets` : 'None'}
        accentClass="border-l-red-500/50"
        titleClass="text-red-400/80"
        compact
        className="mb-0"
        headerRight={
          issues.length > 0 ? (
            <select
              value={issuesFilter}
              onChange={(e) => {
                setIssuesFilter(e.target.value);
                setIssuesPage(1);
              }}
              className={selectClass}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          ) : undefined
        }
      >
        {issues.length === 0 ? (
          <p className="text-[11px] text-gray-500 py-1">No issues reported.</p>
        ) : paginatedIssues.length === 0 ? (
          <p className="text-[11px] text-gray-500 py-1">No issues match filter.</p>
        ) : (
          <div className="divide-y divide-gray-700/30">
            {paginatedIssues.map((issue) => {
              const reports = getReportCount(issue);
              return (
                <div key={issue._id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 text-xs min-w-0">
                  <Link
                    href={`/dashboard/issues/${issue._id}`}
                    className="font-medium text-blue-300 hover:text-blue-200 shrink-0"
                  >
                    {issue.ticketId}
                  </Link>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border capitalize ${
                      ISSUE_STATUS_BADGE[issue.status] || ISSUE_STATUS_BADGE.cancelled
                    }`}
                  >
                    {issue.status.replace('_', ' ')}
                  </span>
                  {reports > 1 && (
                    <span className="text-[10px] text-gray-500 shrink-0">{reports} reports</span>
                  )}
                  <span className="text-gray-300 truncate min-w-0 flex-1">{issue.title}</span>
                  <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">
                    {new Date(issue.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <Pagination
          page={issuesPage}
          totalPages={issuesTotalPages}
          total={filteredIssues.length}
          perPage={PER_PAGE}
          onPageChange={setIssuesPage}
        />
      </Section>
    </div>
  );
}
