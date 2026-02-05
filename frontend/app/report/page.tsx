'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';

const ISSUE_TYPES = [
  { value: 'not_working', label: 'Not working / Not turning on' },
  { value: 'damage', label: 'Damage or physical defect' },
  { value: 'maintenance', label: 'Maintenance needed' },
  { value: 'repair', label: 'Repair needed' },
  { value: 'complaint', label: 'Complaint or other' },
  { value: 'other', label: 'Other' },
];

interface Asset {
  _id: string;
  assetId: string;
  name: string;
  category: string;
  status: string;
  departmentId?: { name: string };
  locationId?: { name: string };
}

interface Report {
  reporterName: string;
  reporterEmail: string;
  createdAt: string;
}

interface PreviousIssue {
  ticketId: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  reports: Report[];
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function ReportContent() {
  const searchParams = useSearchParams();
  const assetId = searchParams.get('assetId') || '';
  const assetName = searchParams.get('assetName') || '';

  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ merged: boolean; ticketId: string; message: string } | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [previousIssues, setPreviousIssues] = useState<PreviousIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);

  // Fetch asset and previous issues when component mounts
  useEffect(() => {
    if (assetId) {
      fetchAssetAndIssues();
    }
  }, [assetId]);

  const fetchAssetAndIssues = async () => {
    setIssuesLoading(true);
    try {
      const res = await fetch(api(`/api/public/report?assetId=${assetId}&assetName=${encodeURIComponent(assetName)}`));
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load asset');
      
      setAsset(data.asset);
      setPreviousIssues(data.previousIssues || []);
    } catch (err) {
      console.error('Failed to load asset:', err);
      // Don't show error for asset loading, just continue without previous issues
    } finally {
      setIssuesLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const photos = photoDataUrl ? [{ url: photoDataUrl }] : undefined;
      const res = await fetch(api('/api/public/report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          reporterName: reporterName.trim(),
          reporterEmail: reporterEmail.trim(),
          reporterPhone: reporterPhone.trim() || undefined,
          issueType: issueType || 'other',
          description: description.trim(),
          photos,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit');
      setSuccess({
        merged: data.merged ?? false,
        ticketId: data.ticketId ?? '',
        message: data.message ?? 'Thank you. Your report has been logged.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Report submitted</h1>
          <p className="text-slate-600 mb-2">{success.message}</p>
          {success.ticketId && (
            <p className="text-sm text-slate-500 mb-6">
              Reference: <strong>{success.ticketId}</strong>
            </p>
          )}
          <Link
            href={assetId ? `/a/${assetId}` : '/'}
            className="inline-block py-2.5 px-5 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover"
          >
            Back to asset
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Column */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h1 className="text-xl font-bold mb-1">Report an issue</h1>
              {asset && (
                <div className="bg-slate-50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-slate-600">
                    <strong>Asset:</strong> {asset.name} ({asset.assetId})
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Category:</strong> {asset.category}
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Status:</strong> {asset.status}
                  </p>
                  {asset.departmentId && (
                    <p className="text-sm text-slate-600">
                      <strong>Department:</strong> {asset.departmentId.name}
                    </p>
                  )}
                </div>
              )}
              {!assetId && (
                <p className="text-amber-700 bg-amber-50 text-sm p-3 rounded-lg mb-4">
                  No asset selected. Open this page from the asset QR or link.
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <p className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
                )}

                <div>
                  <label className="block mb-1.5 font-medium text-slate-700">Your name *</label>
                  <input
                    type="text"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g. John Smith"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 font-medium text-slate-700">Email *</label>
                  <input
                    type="email"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 font-medium text-slate-700">Phone (optional)</label>
                  <input
                    type="tel"
                    value={reporterPhone}
                    onChange={(e) => setReporterPhone(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g. 9876543210"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 font-medium text-slate-700">What's the problem? *</label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select type</option>
                    {ISSUE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1.5 font-medium text-slate-700">Description *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={4}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    placeholder="Describe the issue in a few lines..."
                  />
                </div>

                <div>
                  <label className="block mb-1.5 font-medium text-slate-700">Photo (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                  {photoDataUrl && (
                    <div className="mt-2 relative inline-block">
                      <img src={photoDataUrl} alt="Attached" className="h-20 w-20 object-cover rounded-lg border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => setPhotoDataUrl(null)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !assetId}
                  className="w-full py-3 bg-primary text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-primary-hover"
                >
                  {loading ? 'Submitting…' : 'Submit report'}
                </button>
              </form>

              <Link
                href={assetId ? `/a/${assetId}` : '/'}
                className="block mt-4 text-center text-slate-500 text-sm hover:text-slate-700"
              >
                ← Back to asset
              </Link>
            </div>
          </div>

          {/* Previous Issues Column */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-4">
              <h2 className="text-lg font-bold mb-4">Previous Issues</h2>
              
              {issuesLoading ? (
                <p className="text-slate-500 text-sm">Loading...</p>
              ) : previousIssues.length === 0 ? (
                <p className="text-slate-500 text-sm">No previous issues found for this asset.</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {previousIssues.map((issue) => (
                    <div key={issue.ticketId} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-slate-900 text-sm">{issue.title}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          issue.status === 'open' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {issue.status}
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-600 mb-2">
                        <strong>Ticket:</strong> {issue.ticketId}
                      </p>
                      
                      <p className="text-xs text-slate-700 mb-2 line-clamp-2">
                        {issue.description}
                      </p>
                      
                      <p className="text-xs text-slate-500 mb-2">
                        <strong>Reported:</strong> {new Date(issue.createdAt).toLocaleString()}
                      </p>
                      
                      {issue.reports.length > 0 && (
                        <p className="text-xs text-slate-500">
                          <strong>Reporter:</strong> {issue.reports[0].reporterName}
                          {issue.reports.length > 1 && ` (+${issue.reports.length - 1} more)`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <p className="text-slate-600">Loading…</p>
        </main>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
