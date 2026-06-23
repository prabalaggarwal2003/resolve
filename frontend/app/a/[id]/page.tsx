'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

type Issue = {
  ticketId: string;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
  reports?: { reporterName: string; reporterEmail: string; createdAt: string }[];
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
  maintenanceReason?: string;
  purchaseDate?: string;
  vendor?: string;
  cost?: number;
  warrantyExpiry?: string;
  amcExpiry?: string;
  nextMaintenanceDate?: string;
  locationId?: { name: string; path?: string };
  departmentId?: { name: string };
  photos?: { url: string; caption?: string }[];
  documents?: { url: string; name: string }[];
  previousIssues?: Issue[];
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
  const detailTiles: { label: string; value: string; accent?: string }[] = [];

  if (asset.locationId?.path) detailTiles.push({ label: 'Location', value: asset.locationId.path });
  if (asset.departmentId?.name) detailTiles.push({ label: 'Department', value: asset.departmentId.name });
  if (asset.model) detailTiles.push({ label: 'Model', value: asset.model });
  if (asset.serialNumber) detailTiles.push({ label: 'Serial', value: asset.serialNumber });
  if (asset.purchaseDate) detailTiles.push({ label: 'Purchase date', value: formatDate(asset.purchaseDate) });
  if (asset.cost) detailTiles.push({ label: 'Cost', value: formatCurrency(asset.cost) });
  if (asset.vendor) detailTiles.push({ label: 'Vendor', value: asset.vendor });
  if (asset.warrantyExpiry) detailTiles.push({ label: 'Warranty expires', value: formatDate(asset.warrantyExpiry) });
  if (asset.amcExpiry) detailTiles.push({ label: 'AMC expires', value: formatDate(asset.amcExpiry) });

  return (
    <main className="min-h-screen bg-gray-950 text-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">
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
            {detailTiles.length > 0 && (
              <Section title="Details" accentClass="border-l-violet-500/50" titleClass="text-violet-400/80">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {detailTiles.map((tile) => (
                    <DetailTile key={tile.label} label={tile.label} value={tile.value} accent={tile.accent} />
                  ))}
                </div>
              </Section>
            )}

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
              <Link
                href={`/report?assetId=${asset._id}&assetName=${encodeURIComponent(asset.name)}`}
                className={`${buttonClass} block text-center no-underline w-full sm:w-auto border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30 py-2.5 px-6 text-sm font-semibold`}
              >
                Report an issue
              </Link>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            <Section title="Check issue status" accentClass="border-l-emerald-500/50" titleClass="text-emerald-400/80">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={issueId}
                  onChange={(e) => setIssueId(e.target.value)}
                  placeholder="e.g. ISS-2024-001"
                  className={inputClass}
                  onKeyDown={(e) => e.key === 'Enter' && searchIssue()}
                />
                <button
                  type="button"
                  onClick={searchIssue}
                  disabled={searchingIssue || !issueId.trim()}
                  className={`${buttonClass} border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30 shrink-0`}
                >
                  {searchingIssue ? '…' : 'Search'}
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
                      <span className="text-gray-600">Reported:</span> {formatDate(issueResult.createdAt)}
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

            {asset.previousIssues && asset.previousIssues.length > 0 && (
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
