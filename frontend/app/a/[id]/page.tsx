'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { breadcrumbForNode } from '@/lib/locations';
import { SECTION_LABELS, SECTION_ORDER, type TemplateSection } from '@/lib/assetTemplates';
import { formatOrgMoney } from '@/lib/orgCurrency';
import { formatOrgDate, formatOrgDateTime } from '@/lib/orgTimezone';

type Issue = {
  ticketId: string;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
  reports?: { reporterName: string; reporterEmail: string; createdAt: string }[];
};

type QrViewField = {
  key: string;
  label: string;
  type?: string;
  section: string;
  builtIn?: boolean;
  qrVisible?: boolean;
};

type Asset = {
  _id: string;
  assetId: string;
  name: string;
  model?: string;
  category: string;
  serialNumber?: string;
  status: string;
  condition?: string;
  tags?: string[];
  maintenanceReason?: string;
  maintenanceStartDate?: string;
  maintenanceCompletedDate?: string;
  maintenanceHistory?: {
    startDate: string;
    endDate?: string;
    reason?: string;
    completionReason?: string;
    durationMinutes?: number;
    notes?: string;
  }[];
  purchaseDate?: string;
  vendor?: string;
  vendorId?: { name?: string };
  cost?: number;
  currency?: string;
  timezone?: string;
  warrantyExpiry?: string;
  amcExpiry?: string;
  nextMaintenanceDate?: string;
  assignedToName?: string;
  assignedToEmployeeCode?: string;
  locationId?: { name: string; path?: string };
  departmentId?: { name: string };
  photos?: { url: string; caption?: string }[];
  documents?: { url: string; name: string }[];
  customFields?: Record<string, unknown>;
  previousIssues?: Issue[];
  qrView?: {
    sections: Record<string, boolean>;
    fields: QrViewField[];
  };
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  in_use: 'In use',
  working: 'Working',
  under_maintenance: 'Under maintenance',
  needs_repair: 'Needs repair',
  out_of_service: 'Out of service',
  retired: 'Retired',
};

const STATUS_BADGE: Record<string, string> = {
  available: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  in_use: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  working: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  under_maintenance: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  needs_repair: 'text-red-300 bg-red-500/15 border-red-500/30',
  out_of_service: 'text-red-300 bg-red-500/15 border-red-500/30',
  retired: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
};

const ISSUE_STATUS_BADGE: Record<string, string> = {
  new: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  open: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  triaged: 'text-violet-300 bg-violet-500/15 border-violet-500/30',
  assigned: 'text-sky-300 bg-sky-500/15 border-sky-500/30',
  in_progress: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  waiting: 'text-orange-300 bg-orange-500/15 border-orange-500/30',
  resolved: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  verified: 'text-teal-300 bg-teal-500/15 border-teal-500/30',
  completed: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  closed: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
  cancelled: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
};

const inputClass =
  'flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const selectClass =
  'px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-300 focus:ring-1 focus:ring-blue-500/40 shrink-0';
const buttonClass =
  'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function formatCurrency(amount: number, currency?: string) {
  return formatOrgMoney(amount, currency);
}

function formatDate(iso: string, timezone?: string): string {
  return formatOrgDate(iso, timezone);
}

function DetailTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xs font-medium mt-0.5 break-words ${accent || 'text-gray-200'}`}>{value}</p>
    </div>
  );
}

function Section({
  title,
  accentClass,
  titleClass,
  children,
  headerRight,
  className = '',
}: {
  title: string;
  accentClass: string;
  titleClass: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-700/60 border-l-2 ${accentClass} bg-gray-800/40 px-3 py-2.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={`text-[10px] font-semibold uppercase tracking-widest ${titleClass}`}>{title}</p>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

export default function PublicAssetPage() {
  const params = useParams();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [issueId, setIssueId] = useState('');
  const [searchingIssue, setSearchingIssue] = useState(false);
  const [issueResult, setIssueResult] = useState<{
    ticketId: string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    category?: string;
    createdAt: string;
    assignedTo?: { name: string };
    resolutionNotes?: string;
  } | null>(null);
  const [issueError, setIssueError] = useState('');
  const [issueSort, setIssueSort] = useState<
    'all' | 'new' | 'open' | 'in_progress' | 'waiting' | 'resolved' | 'completed' | 'closed' | 'cancelled'
  >('all');

  useEffect(() => {
    if (!params.id) {
      setLoading(false);
      setError('Invalid link');
      return;
    }
    fetch(api(`/api/public/assets/${params.id}`))
      .then((res) => res.json())
      .then((data) => {
        if (data.message && data.message === 'Asset not found') {
          setError('Asset not found');
          return;
        }
        setAsset(data);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const searchIssue = async () => {
    if (!issueId.trim()) {
      setIssueError('Please enter an issue ID');
      return;
    }

    setSearchingIssue(true);
    setIssueError('');
    setIssueResult(null);

    try {
      const res = await fetch(api(`/api/public/issues/${issueId.trim()}`));
      const data = await res.json();

      if (res.ok) {
        setIssueResult(data);
      } else {
        setIssueError(data.message || 'Issue not found');
      }
    } catch {
      setIssueError('Failed to search issue');
    } finally {
      setSearchingIssue(false);
    }
  };

  const sortedIssues = asset?.previousIssues
    ? issueSort === 'all'
      ? asset.previousIssues
      : issueSort === 'new'
        ? asset.previousIssues.filter((issue) => issue.status === 'new' || issue.status === 'open')
        : issueSort === 'resolved'
          ? asset.previousIssues.filter(
              (issue) => issue.status === 'resolved' || issue.status === 'completed'
            )
          : asset.previousIssues.filter((issue) => issue.status === issueSort)
    : [];

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <LoadingSpinner message="Loading asset..." />
      </main>
    );
  }

  if (error || !asset) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 gap-3">
        <p className="text-red-400 text-sm">{error || 'Asset not found'}</p>
        <Link href="/" className="text-xs text-blue-400 hover:text-blue-300 no-underline">
          Go to Resolve
        </Link>
      </main>
    );
  }

  const statusBadge = STATUS_BADGE[asset.status] ?? STATUS_BADGE.retired;
  const qrSections = asset.qrView?.sections || {
    basic: true,
    assignment: true,
    purchase: true,
    custom: true,
    photos: true,
    documents: true,
    maintenance: true,
    issues: true,
  };
  const qrFields = asset.qrView?.fields || [];

  const formatFieldValue = (field: QrViewField): string | null => {
    const key = field.key;
    if (key === 'locationId') return breadcrumbForNode(asset.locationId) || null;
    if (key === 'departmentId') return asset.departmentId?.name || null;
    if (key === 'vendorId') return asset.vendor || asset.vendorId?.name || null;
    if (key === 'assignedToName') return asset.assignedToName || null;
    if (key === 'assignedToEmployeeCode') return asset.assignedToEmployeeCode || null;
    if (key === 'model') return asset.model || null;
    if (key === 'serialNumber') return asset.serialNumber || null;
    if (key === 'condition') return asset.condition ? asset.condition.replace(/_/g, ' ') : null;
    if (key === 'status') return STATUS_LABELS[asset.status] ?? asset.status.replace(/_/g, ' ');
    if (key === 'name') return asset.name || null;
    if (key === 'tags') {
      return Array.isArray(asset.tags) && asset.tags.length ? asset.tags.join(', ') : null;
    }
    if (key === 'purchaseDate' && asset.purchaseDate) return formatDate(asset.purchaseDate, asset.timezone);
    if (key === 'warrantyExpiry' && asset.warrantyExpiry) return formatDate(asset.warrantyExpiry, asset.timezone);
    if (key === 'amcExpiry' && asset.amcExpiry) return formatDate(asset.amcExpiry, asset.timezone);
    if (key === 'nextMaintenanceDate' && asset.nextMaintenanceDate) {
      return formatDate(asset.nextMaintenanceDate, asset.timezone);
    }
    if (key === 'cost' && asset.cost != null) return formatCurrency(asset.cost, asset.currency);

    const custom = asset.customFields?.[key];
    if (custom != null && custom !== '') {
      if (Array.isArray(custom)) return custom.join(', ');
      if (typeof custom === 'boolean') return custom ? 'Yes' : 'No';
      if (typeof custom === 'string' && /^\d{4}-\d{2}-\d{2}/.test(custom)) {
        return formatDate(custom, asset.timezone);
      }
      return String(custom);
    }

    const top = (asset as unknown as Record<string, unknown>)[key];
    if (top == null || top === '') return null;
    if (typeof top === 'object') return null;
    return String(top);
  };

  const sectionTiles = SECTION_ORDER.map((section) => {
    if (qrSections[section] === false) return null;
    const fields = qrFields.filter((f) => (f.section || 'basic') === section);
    // Skip name/status in basic tiles — already in header
    const tiles = fields
      .filter((f) => !['name', 'status', 'assetId', 'category'].includes(f.key))
      .map((f) => {
        const value = formatFieldValue(f);
        if (value == null || value === '') return null;
        return { key: f.key, label: f.label, value };
      })
      .filter(Boolean) as { key: string; label: string; value: string }[];
    if (!tiles.length) return null;
    return { section, tiles };
  }).filter(Boolean) as { section: TemplateSection; tiles: { key: string; label: string; value: string }[] }[];

  return (
    <main className="min-h-screen bg-gray-950 text-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">
        <Section title="Check issue status" accentClass="border-l-emerald-500/50" titleClass="text-emerald-400/80">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={issueId}
              onChange={(e) => setIssueId(e.target.value)}
              placeholder="Enter Issue ID (e.g. ISS-2024-001)"
              className={inputClass}
              onKeyDown={(e) => e.key === 'Enter' && searchIssue()}
            />
            <button
              type="button"
              onClick={searchIssue}
              disabled={searchingIssue || !issueId.trim()}
              className={`${buttonClass} border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30 shrink-0`}
            >
              {searchingIssue ? 'Searching…' : 'Search'}
            </button>
          </div>

          {issueError && (
            <p className="mt-2 text-[11px] text-red-400 px-2 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
              {issueError}
            </p>
          )}

          {issueResult && (
            <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-emerald-300">{issueResult.ticketId}</span>
                <span
                  className={`px-1.5 py-0.5 text-[9px] rounded border capitalize ${
                    ISSUE_STATUS_BADGE[issueResult.status] || ISSUE_STATUS_BADGE.cancelled
                  }`}
                >
                  {issueResult.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs font-medium text-gray-200">{issueResult.title}</p>
              {issueResult.description && (
                <p className="text-[11px] text-gray-400 line-clamp-3">{issueResult.description}</p>
              )}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] text-gray-500 pt-1 border-t border-gray-700/30">
                {issueResult.priority && (
                  <span>
                    <span className="text-gray-600">Priority:</span> {issueResult.priority}
                  </span>
                )}
                {issueResult.category && (
                  <span>
                    <span className="text-gray-600">Category:</span> {issueResult.category}
                  </span>
                )}
                <span>
                  <span className="text-gray-600">Reported:</span>{' '}
                  {formatDate(issueResult.createdAt, asset.timezone)}
                </span>
                {issueResult.assignedTo && (
                  <span className="truncate">
                    <span className="text-gray-600">Assigned:</span> {issueResult.assignedTo.name}
                  </span>
                )}
              </div>
              {issueResult.resolutionNotes && (
                <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-700/30">
                  <span className="text-gray-500 font-medium">Resolution:</span> {issueResult.resolutionNotes}
                </p>
              )}
            </div>
          )}
        </Section>

        {/* Header */}
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gray-800/40 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-100 leading-tight">{asset.name}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {asset.assetId} · {asset.category}
              </p>
            </div>
            <span className={`px-2 py-0.5 text-[10px] rounded border capitalize ${statusBadge}`}>
              {STATUS_LABELS[asset.status] ?? asset.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main column */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {sectionTiles.map(({ section, tiles }) => (
              <Section
                key={section}
                title={SECTION_LABELS[section]}
                accentClass={
                  section === 'assignment'
                    ? 'border-l-blue-500/50'
                    : section === 'purchase'
                    ? 'border-l-amber-500/50'
                    : section === 'custom'
                    ? 'border-l-emerald-500/50'
                    : 'border-l-violet-500/50'
                }
                titleClass={
                  section === 'assignment'
                    ? 'text-blue-400/80'
                    : section === 'purchase'
                    ? 'text-amber-400/80'
                    : section === 'custom'
                    ? 'text-emerald-400/80'
                    : 'text-violet-400/80'
                }
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tiles.map((tile) => (
                    <DetailTile key={tile.key} label={tile.label} value={tile.value} />
                  ))}
                </div>
              </Section>
            ))}

            {asset.status === 'under_maintenance' ? (
              <Section title="Reporting unavailable" accentClass="border-l-amber-500/50" titleClass="text-amber-400/80">
                <div className="flex items-start gap-2">
                  <span className="text-base">🔧</span>
                  <div className="min-w-0">
                    <p className="text-xs text-amber-200/90">
                      This asset is under maintenance. Issue reporting is temporarily disabled.
                    </p>
                    {asset.maintenanceReason && (
                      <p className="text-[10px] text-amber-400/70 mt-1">
                        <span className="font-medium">Reason:</span> {asset.maintenanceReason}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled
                  className={`${buttonClass} mt-3 w-full border-gray-700/60 bg-gray-800/40 text-gray-500 cursor-not-allowed`}
                >
                  Reporting disabled
                </button>
              </Section>
            ) : (
              <div className="space-y-3">
                {asset.previousIssues &&
                  asset.previousIssues.filter((i) =>
                    ['new', 'open', 'triaged', 'assigned', 'in_progress', 'waiting'].includes(i.status)
                  ).length > 0 && (
                    <Section
                      title={`Open tickets (${
                        asset.previousIssues.filter((i) =>
                          ['new', 'open', 'triaged', 'assigned', 'in_progress', 'waiting'].includes(
                            i.status
                          )
                        ).length
                      })`}
                      accentClass="border-l-amber-500/50"
                      titleClass="text-amber-400/80"
                    >
                      <div className="space-y-1.5">
                        {asset.previousIssues
                          .filter((i) =>
                            ['new', 'open', 'triaged', 'assigned', 'in_progress', 'waiting'].includes(
                              i.status
                            )
                          )
                          .slice(0, 5)
                          .map((issue) => (
                            <div
                              key={issue.ticketId}
                              className="rounded-lg border border-gray-700/40 bg-gray-900/30 px-2.5 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-mono text-gray-400">{issue.ticketId}</span>
                                <span className="text-[10px] text-gray-500 capitalize">
                                  {issue.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <p className="text-xs text-gray-200 mt-0.5 truncate">{issue.title}</p>
                            </div>
                          ))}
                      </div>
                    </Section>
                  )}
                <Link
                  href={`/report?assetId=${asset._id}&assetName=${encodeURIComponent(asset.name)}`}
                  className={`${buttonClass} block text-center no-underline w-full sm:w-auto border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30 py-2.5 px-6 text-sm font-semibold`}
                >
                  Report an issue
                </Link>
                <Link
                  href={`/track?assetId=${asset._id}`}
                  className={`${buttonClass} block text-center no-underline w-full sm:w-auto border-gray-700/60 bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 py-2 px-6 text-xs`}
                >
                  Track my report
                </Link>
              </div>
            )}

            {qrSections.photos !== false && (asset.photos?.length ?? 0) > 0 && (
              <Section title="Photos" accentClass="border-l-violet-500/50" titleClass="text-violet-400/80">
                <div className="flex flex-wrap gap-3">
                  {asset.photos!.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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

            {qrSections.documents !== false && (asset.documents?.length ?? 0) > 0 && (
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

            {qrSections.maintenance !== false &&
              (asset.maintenanceHistory?.length || asset.maintenanceReason || asset.status === 'under_maintenance') && (
              <Section title="Maintenance" accentClass="border-l-amber-500/50" titleClass="text-amber-400/80">
                {asset.maintenanceReason && (
                  <p className="text-xs text-gray-400">
                    <span className="text-gray-500 font-medium">Reason:</span> {asset.maintenanceReason}
                  </p>
                )}
                {asset.maintenanceStartDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    Started: {formatOrgDateTime(asset.maintenanceStartDate, asset.timezone)}
                  </p>
                )}
                {asset.maintenanceCompletedDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    Completed: {formatOrgDateTime(asset.maintenanceCompletedDate, asset.timezone)}
                  </p>
                )}
                {asset.maintenanceHistory?.length ? (
                  <div className="mt-2 space-y-1.5">
                    {asset.maintenanceHistory.slice().reverse().slice(0, 6).map((entry, idx) => (
                      <div key={`${entry.startDate}-${idx}`} className="rounded-lg border border-gray-700/40 bg-gray-900/30 px-2.5 py-2">
                        <p className="text-[11px] text-gray-300">
                          {formatDate(entry.startDate, asset.timezone)}
                          {entry.endDate ? ` → ${formatDate(entry.endDate, asset.timezone)}` : ' → ongoing'}
                        </p>
                        {entry.reason && <p className="text-[10px] text-gray-500 mt-0.5">Started · {entry.reason}</p>}
                        {entry.completionReason && (
                          <p className="text-[10px] text-emerald-400/80 mt-0.5">Completed · {entry.completionReason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-600 mt-2">No maintenance history available.</p>
                )}
              </Section>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {qrSections.issues !== false && asset.previousIssues && asset.previousIssues.length > 0 && (
              <Section
                title={`Previous issues (${sortedIssues.length})`}
                accentClass="border-l-amber-500/50"
                titleClass="text-amber-400/80"
                headerRight={
                  <select
                    value={issueSort}
                    onChange={(e) => setIssueSort(e.target.value as typeof issueSort)}
                    className={selectClass}
                  >
                    <option value="all">All ({asset.previousIssues.length})</option>
                    <option value="new">
                      New (
                      {
                        asset.previousIssues.filter((i) => i.status === 'new' || i.status === 'open')
                          .length
                      }
                      )
                    </option>
                    <option value="in_progress">
                      In progress ({asset.previousIssues.filter((i) => i.status === 'in_progress').length})
                    </option>
                    <option value="waiting">
                      Waiting ({asset.previousIssues.filter((i) => i.status === 'waiting').length})
                    </option>
                    <option value="resolved">
                      Resolved (
                      {
                        asset.previousIssues.filter(
                          (i) => i.status === 'resolved' || i.status === 'completed'
                        ).length
                      }
                      )
                    </option>
                    <option value="closed">
                      Closed ({asset.previousIssues.filter((i) => i.status === 'closed').length})
                    </option>
                    <option value="cancelled">
                      Cancelled ({asset.previousIssues.filter((i) => i.status === 'cancelled').length})
                    </option>
                  </select>
                }
              >
                {sortedIssues.length === 0 ? (
                  <p className="text-[11px] text-gray-500 text-center py-3">No issues with this status</p>
                ) : (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {sortedIssues.map((issue) => (
                      <div
                        key={issue.ticketId}
                        className="rounded-lg border border-gray-700/40 bg-gray-900/30 px-2.5 py-2"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-[11px] font-semibold text-gray-200">{issue.ticketId}</span>
                          <span
                            className={`px-1.5 py-0.5 text-[9px] rounded border capitalize shrink-0 ${
                              ISSUE_STATUS_BADGE[issue.status] ?? ISSUE_STATUS_BADGE.cancelled
                            }`}
                          >
                            {issue.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 font-medium truncate">{issue.title}</p>
                        {issue.description && (
                          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{issue.description}</p>
                        )}
                        <p className="text-[10px] text-gray-600 mt-1">
                          {formatOrgDateTime(issue.createdAt, asset.timezone)}
                          {issue.reports && issue.reports.length > 1 && ` · ${issue.reports.length} reports`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
