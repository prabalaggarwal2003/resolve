'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  working: 'Working',
  under_maintenance: 'Under maintenance',
  needs_repair: 'Needs repair',
  out_of_service: 'Out of service',
};

const STATUS_CLASSES: Record<string, string> = {
  working: 'bg-green-100 text-green-800',
  under_maintenance: 'bg-amber-100 text-amber-800',
  needs_repair: 'bg-red-100 text-red-800',
  out_of_service: 'bg-slate-200 text-slate-600',
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

export default function PublicAssetPage() {
  const params = useParams();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [issueId, setIssueId] = useState('');
  const [searchingIssue, setSearchingIssue] = useState(false);
  const [issueResult, setIssueResult] = useState<any>(null);
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
    } catch (err) {
      setIssueError('Failed to search issue');
    } finally {
      setSearchingIssue(false);
    }
  };

  // Sort/filter issues based on status
  const sortedIssues = asset?.previousIssues
    ? issueSort === 'all'
      ? asset.previousIssues
      : asset.previousIssues.filter(issue => issue.status === issueSort)
    : [];

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (error || !asset) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-600 mb-4">{error || 'Asset not found'}</p>
        <Link href="/" className="text-primary font-medium hover:underline">
          Go to Resolve
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Asset Info and Actions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Header — mobile-friendly */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h1 className="text-xl font-bold text-slate-900 mb-1">{asset.name}</h1>
              <p className="text-slate-600 text-sm mb-2">
                {asset.assetId} · {asset.category}
              </p>
              <span
                className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${STATUS_CLASSES[asset.status] ?? 'bg-slate-100 text-slate-700'}`}
              >
                {STATUS_LABELS[asset.status] ?? asset.status}
              </span>
            </div>

            {/* Details */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Details
              </h2>
              <dl className="space-y-2 text-sm">
          {asset.purchaseDate && (
            <div>
              <dt className="text-slate-500">Purchase date</dt>
              <dd className="font-medium">
                {new Date(asset.purchaseDate).toLocaleDateString()}
              </dd>
            </div>
          )}
          {asset.cost && (
            <div>
              <dt className="text-slate-500">Cost</dt>
              <dd className="font-medium">
                {asset.cost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </dd>
            </div>
          )}
          {asset.vendor && (
            <div>
              <dt className="text-slate-500">Vendor</dt>
              <dd className="font-medium">{asset.vendor}</dd>
            </div>
          )}
          {asset.locationId?.path && (
            <div>
              <dt className="text-slate-500">Location</dt>
              <dd className="font-medium">{asset.locationId.path}</dd>
            </div>
          )}
          {asset.model && (
            <div>
              <dt className="text-slate-500">Model</dt>
              <dd className="font-medium">{asset.model}</dd>
            </div>
          )}
          {asset.serialNumber && (
            <div>
              <dt className="text-slate-500">Serial</dt>
              <dd className="font-medium">{asset.serialNumber}</dd>
            </div>
          )}
          {asset.warrantyExpiry && (
            <div>
              <dt className="text-slate-500">Warranty expires</dt>
              <dd className="font-medium">
                {new Date(asset.warrantyExpiry).toLocaleDateString()}
              </dd>
            </div>
          )}
          {asset.amcExpiry && (
            <div>
              <dt className="text-slate-500">AMC expires</dt>
              <dd className="font-medium">
                {new Date(asset.amcExpiry).toLocaleDateString()}
              </dd>
            </div>
          )}
              </dl>
            </div>

            {/* Report issue — prominent for scan flow, or maintenance warning */}
            {asset.status === 'under_maintenance' ? (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🔧</div>
                  <div>
                    <h3 className="font-bold text-amber-900 text-lg mb-1">Can't Report Issues</h3>
                    <p className="text-amber-800 text-sm mb-2">
                      This asset is currently under maintenance and issue reporting is temporarily disabled.
                    </p>
                    {asset.maintenanceReason && (
                      <p className="text-amber-700 text-xs">
                        <span className="font-medium">Reason:</span> {asset.maintenanceReason}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  disabled
                  className="mt-4 w-full py-3 bg-gray-300 text-gray-500 text-center font-semibold rounded-lg cursor-not-allowed"
                >
                  🚫 Reporting Disabled
                </button>
              </div>
            ) : (
              <Link
                href={`/report?assetId=${asset._id}&assetName=${encodeURIComponent(asset.name)}`}
                className="block w-full py-4 bg-primary text-white text-center font-semibold rounded-xl hover:bg-primary-hover shadow-sm"
              >
                Report an issue
              </Link>
            )}
          </div>

          {/* Right Column - Issue Search and Previous Issues */}
          <div className="lg:col-span-1 space-y-4">
            {/* Issue Search */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Check Issue Status
              </h2>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={issueId}
                    onChange={(e) => setIssueId(e.target.value)}
                    placeholder="Enter issue ID (e.g., ISS-2024-001)"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && searchIssue()}
                  />
                  <button
                    type="button"
                    onClick={searchIssue}
                    disabled={searchingIssue || !issueId.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm disabled:opacity-60"
                  >
                    {searchingIssue ? 'Searching…' : 'Search'}
                  </button>
                </div>

                {issueError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{issueError}</p>
                  </div>
                )}

                {issueResult && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-green-900">{issueResult.ticketId}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          issueResult.status === 'open' ? 'bg-red-100 text-red-800' :
                          issueResult.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          issueResult.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {issueResult.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-medium text-green-900 mb-1">{issueResult.title}</h4>
                        <p className="text-green-700 text-sm">{issueResult.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                        <div>
                          <span className="font-medium">Priority:</span> {issueResult.priority}
                        </div>
                        <div>
                          <span className="font-medium">Category:</span> {issueResult.category}
                        </div>
                        <div>
                          <span className="font-medium">Reported:</span> {new Date(issueResult.createdAt).toLocaleDateString()}
                        </div>
                        {issueResult.assignedTo && (
                          <div>
                            <span className="font-medium">Assigned to:</span> {issueResult.assignedTo.name}
                          </div>
                        )}
                      </div>

                      {issueResult.resolutionNotes && (
                        <div className="mt-2 pt-2 border-t border-green-200">
                          <p className="text-sm font-medium text-green-900 mb-1">Resolution:</p>
                          <p className="text-green-700 text-sm">{issueResult.resolutionNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Previous Issues Section */}
            {asset.previousIssues && asset.previousIssues.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                    Previous Issues ({sortedIssues.length})
                  </h2>
                  <select
                    value={issueSort}
                    onChange={(e) => setIssueSort(e.target.value as any)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="all">All ({asset.previousIssues.length})</option>
                    <option value="open">Open ({asset.previousIssues.filter(i => i.status === 'open').length})</option>
                    <option value="in_progress">In Progress ({asset.previousIssues.filter(i => i.status === 'in_progress').length})</option>
                    <option value="completed">Completed ({asset.previousIssues.filter(i => i.status === 'completed').length})</option>
                    <option value="cancelled">Cancelled ({asset.previousIssues.filter(i => i.status === 'cancelled').length})</option>
                  </select>
                </div>

                {sortedIssues.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">No issues with this status</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {sortedIssues.map((issue) => (
                      <div key={issue.ticketId} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-slate-900">{issue.ticketId}</span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              ISSUE_STATUS_CLASSES[issue.status] ?? 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {issue.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <h3 className="font-medium text-slate-900 mb-1">{issue.title}</h3>
                        {issue.description && (
                          <p className="text-slate-600 text-sm mb-2">{issue.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>Reported: {new Date(issue.createdAt).toLocaleDateString()}</span>
                          {issue.reports && issue.reports.length > 1 && (
                            <>
                              <span>·</span>
                              <span>{issue.reports.length} report(s)</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-slate-500 text-sm">
          <Link href="/" className="text-primary hover:underline">
            Resolve
          </Link>
          {' · Asset management'}
        </p>
      </div>
    </main>
  );
}
