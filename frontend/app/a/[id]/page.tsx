'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { breadcrumbForNode } from '@/lib/locations';
import { SECTION_LABELS, SECTION_ORDER, type TemplateSection } from '@/lib/assetTemplates';
import { formatOrgMoney } from '@/lib/orgCurrency';

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
  open: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  in_progress: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  completed: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  cancelled: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
};

// Used by Check issue status / Report an issue (currently commented out below)
// const inputClass =
//   'flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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
  // Issue reporting / status lookup — hidden for now; uncomment to restore
  // const [issueId, setIssueId] = useState('');
  // const [searchingIssue, setSearchingIssue] = useState(false);
  // const [issueResult, setIssueResult] = useState<{
  //   ticketId: string;
  //   title: string;
  //   description?: string;
  //   status: string;
  //   priority?: string;
  //   category?: string;
  //   createdAt: string;
  //   assignedTo?: { name: string };
  //   resolutionNotes?: string;
  // } | null>(null);
  // const [issueError, setIssueError] = useState('');
  const [issueSort, setIssueSort] = useState<'all' | 'open' | 'in_progress' | 'completed' | 'cancelled'>('all');

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

  // Issue status search — hidden for now; uncomment with the Check issue status UI
  // const searchIssue = async () => {
  //   if (!issueId.trim()) {
  //     setIssueError('Please enter an issue ID');
  //     return;
  //   }
  //
  //   setSearchingIssue(true);
  //   setIssueError('');
  //   setIssueResult(null);
  //
  //   try {
  //     const res = await fetch(api(`/api/public/issues/${issueId.trim()}`));
  //     const data = await res.json();
  //
  //     if (res.ok) {
  //       setIssueResult(data);
  //     } else {
  //       setIssueError(data.message || 'Issue not found');
  //     }
  //   } catch {
  //     setIssueError('Failed to search issue');
  //   } finally {
  //     setSearchingIssue(false);
  //   }
  // };

  const sortedIssues = asset?.previousIssues
    ? issueSort === 'all'
      ? asset.previousIssues
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
    if (key === 'purchaseDate' && asset.purchaseDate) return formatDate(asset.purchaseDate);
    if (key === 'warrantyExpiry' && asset.warrantyExpiry) return formatDate(asset.warrantyExpiry);
    if (key === 'amcExpiry' && asset.amcExpiry) return formatDate(asset.amcExpiry);
    if (key === 'nextMaintenanceDate' && asset.nextMaintenanceDate) return formatDate(asset.nextMaintenanceDate);
    if (key === 'cost' && asset.cost != null) return formatCurrency(asset.cost, asset.currency);

    const custom = asset.customFields?.[key];
    if (custom != null && custom !== '') {
      if (Array.isArray(custom)) return custom.join(', ');
      if (typeof custom === 'boolean') return custom ? 'Yes' : 'No';
      if (typeof custom === 'string' && /^\d{4}-\d{2}-\d{2}/.test(custom)) return formatDate(custom);
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
        {/* Check issue status — hidden for now; uncomment to restore public ticket lookup
        ...
        */}

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

            {/* Report an issue — hidden for now; uncomment to restore QR reporting */}

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
                  <p className="text-xs text-gray-500 mt-1">Started: {new Date(asset.maintenanceStartDate).toLocaleString('en-IN')}</p>
                )}
                {asset.maintenanceCompletedDate && (
                  <p className="text-xs text-gray-500 mt-1">Completed: {new Date(asset.maintenanceCompletedDate).toLocaleString('en-IN')}</p>
                )}
                {asset.maintenanceHistory?.length ? (
                  <div className="mt-2 space-y-1.5">
                    {asset.maintenanceHistory.slice().reverse().slice(0, 6).map((entry, idx) => (
                      <div key={`${entry.startDate}-${idx}`} className="rounded-lg border border-gray-700/40 bg-gray-900/30 px-2.5 py-2">
                        <p className="text-[11px] text-gray-300">
                          {formatDate(entry.startDate)}
                          {entry.endDate ? ` → ${formatDate(entry.endDate)}` : ' → ongoing'}
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
                    <option value="open">
                      Open ({asset.previousIssues.filter((i) => i.status === 'open').length})
                    </option>
                    <option value="in_progress">
                      In progress ({asset.previousIssues.filter((i) => i.status === 'in_progress').length})
                    </option>
                    <option value="completed">
                      Completed ({asset.previousIssues.filter((i) => i.status === 'completed').length})
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
                          {formatDate(issue.createdAt)}
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
