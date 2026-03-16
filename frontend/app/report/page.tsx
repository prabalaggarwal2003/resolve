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
  condition?: string;
  maintenanceReason?: string;
  departmentId?: { name: string };
  locationId?: { name: string };
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

  // Fetch asset when component mounts
  useEffect(() => {
    if (assetId) {
      fetchAsset();
    }
  }, [assetId]);

  const fetchAsset = async () => {
    try {
      const res = await fetch(api(`/api/public/assets/${assetId}`));
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load asset');
      
      setAsset(data);
    } catch (err) {
      console.error('Failed to load asset:', err);
      // Don't show error for asset loading, just continue
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
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-900/30 text-green-400 mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2 text-gray-100">Report submitted</h1>
          <p className="text-gray-400 mb-2">{success.message}</p>
          {success.ticketId && (
            <p className="text-sm text-gray-500 mb-6">Reference: <strong className="text-gray-300">{success.ticketId}</strong></p>
          )}
          <Link href={assetId ? `/a/${assetId}` : '/'} className="inline-block py-2.5 px-5 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 no-underline">
            Back to asset
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-6">
          <h1 className="text-xl font-bold mb-1 text-gray-100">Report an issue</h1>
          {asset && (
            <div className="bg-gray-900 p-3 rounded-lg mb-4 border border-gray-700">
              <p className="text-sm text-gray-400"><strong className="text-gray-300">Asset:</strong> {asset.name} ({asset.assetId})</p>
              <p className="text-sm text-gray-400"><strong className="text-gray-300">Category:</strong> {asset.category}</p>
              <p className="text-sm text-gray-400"><strong className="text-gray-300">Status:</strong> {asset.status}</p>
              {asset.departmentId && (
                <p className="text-sm text-gray-400"><strong className="text-gray-300">Department:</strong> {asset.departmentId.name}</p>
              )}
            </div>
          )}

          {/* Maintenance Warning */}
          {asset?.status === 'under_maintenance' && (
            <div className="bg-amber-900/20 border-2 border-amber-800 rounded-xl p-5 mb-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🔧</div>
                <div>
                  <h3 className="font-bold text-amber-400 text-lg mb-1">Can't Report Issues</h3>
                  <p className="text-amber-400 text-sm mb-2">This asset is currently under maintenance and issue reporting is temporarily disabled.</p>
                  {asset.maintenanceReason && (
                    <p className="text-amber-500 text-xs"><span className="font-medium">Reason:</span> {asset.maintenanceReason}</p>
                  )}
                </div>
              </div>
              <Link href={assetId ? `/a/${assetId}` : '/'} className="mt-4 block w-full py-3 bg-amber-700 text-white text-center font-semibold rounded-lg hover:bg-amber-600 no-underline">
                ← Back to Asset
              </Link>
            </div>
          )}

          {!assetId && (
            <p className="text-amber-400 bg-amber-900/20 border border-amber-800 text-sm p-3 rounded-lg mb-4">
              No asset selected. Open this page from the asset QR or link.
            </p>
          )}

          {asset?.status !== 'under_maintenance' && (
          <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-lg text-sm">{error}</p>}
                <div>
                  <label className="block mb-1.5 font-medium text-gray-300">Your name *</label>
                  <input type="text" value={reporterName} onChange={(e) => setReporterName(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                    placeholder="e.g. John Smith" />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-gray-300">Email *</label>
                  <input type="email" value={reporterEmail} onChange={(e) => setReporterEmail(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                    placeholder="you@example.com" />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-gray-300">Phone (optional)</label>
                  <input type="tel" value={reporterPhone} onChange={(e) => setReporterPhone(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                    placeholder="e.g. 9876543210" />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-gray-300">What's the problem? *</label>
                  <select value={issueType} onChange={(e) => setIssueType(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent">
                    <option value="">Select type</option>
                    {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-gray-300">Description *</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4}
                    className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent resize-none"
                    placeholder="Describe the issue in a few lines..." />
                </div>
                <div>
                  {/*<label className="block mb-1.5 font-medium text-gray-300">Photo (optional)</label>*/}
                  {/*<input type="file" accept="image/*" onChange={handlePhotoChange}*/}
                  {/*  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600" />*/}
                  {/*{photoDataUrl && (*/}
                  {/*  <div className="mt-2 relative inline-block">*/}
                  {/*    <img src={photoDataUrl} alt="Attached" className="h-20 w-20 object-cover rounded-lg border border-gray-700" />*/}
                  {/*    <button type="button" onClick={() => setPhotoDataUrl(null)}*/}
                  {/*      className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500">×</button>*/}
                  {/*  </div>*/}
                  {/*)}*/}
                </div>
            <button type="submit" disabled={loading || !assetId}
              className="w-full py-3 bg-gray-700 text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-gray-600">
              {loading ? 'Submitting…' : 'Submit report'}
            </button>
          </form>
          )}

          {asset?.status !== 'under_maintenance' && (
          <Link href={assetId ? `/a/${assetId}` : '/'} className="block mt-4 text-center text-gray-500 text-sm hover:text-gray-300 no-underline">
            ← Back to asset
          </Link>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <p className="text-gray-400">Loading…</p>
      </main>
    }>
      <ReportContent />
    </Suspense>
  );
}
