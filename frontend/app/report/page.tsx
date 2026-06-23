'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

const ISSUE_TYPES = [
  { value: 'not_working', label: 'Not working / Not turning on' },
  { value: 'damage', label: 'Damage or physical defect' },
  { value: 'maintenance', label: 'Maintenance needed' },
  { value: 'repair', label: 'Repair needed' },
  { value: 'complaint', label: 'Complaint or other' },
  { value: 'other', label: 'Other' },
];

const STATUS_BADGE: Record<string, string> = {
  available: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  in_use: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  working: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  under_maintenance: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  needs_repair: 'text-red-300 bg-red-500/15 border-red-500/30',
  out_of_service: 'text-red-300 bg-red-500/15 border-red-500/30',
  retired: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
};

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50';

interface Asset {
  _id: string;
  assetId: string;
  name: string;
  category: string;
  status: string;
  condition?: string;
  maintenanceReason?: string;
  departmentId?: { name: string };
  locationId?: { name: string; path?: string };
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && ' *'}
      </label>
      {children}
    </div>
  );
}

function Section({
  title,
  accentClass,
  titleClass,
  children,
}: {
  title: string;
  accentClass: string;
  titleClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-gray-700/60 border-l-2 ${accentClass} bg-gray-800/40 px-3 py-2.5`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2.5 ${titleClass}`}>{title}</p>
      {children}
    </div>
  );
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ merged: boolean; ticketId: string; message: string } | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (assetId) fetchAsset();
  }, [assetId]);

  const fetchAsset = async () => {
    try {
      const res = await fetch(api(`/api/public/assets/${assetId}`));
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load asset');
      setAsset(data);
    } catch {
      // Continue without asset details
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
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
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-5 py-6 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-emerald-500/15 text-emerald-400 mb-3 text-lg">
            ✓
          </div>
          <h1 className="text-base font-bold text-gray-100 mb-1">Report submitted</h1>
          <p className="text-xs text-gray-400 mb-2">{success.message}</p>
          {success.ticketId && (
            <p className="text-[11px] text-gray-500 mb-4">
              Reference: <span className="text-gray-300 font-medium">{success.ticketId}</span>
            </p>
          )}
          <Link
            href={assetId ? `/a/${assetId}` : '/'}
            className={`${buttonClass} inline-block no-underline border-gray-700/60 bg-gray-800/60 text-gray-200 hover:bg-gray-700/60 py-2 px-4`}
          >
            Back to asset
          </Link>
        </div>
      </main>
    );
  }

  const displayName = asset?.name || assetName;
  const isUnderMaintenance = asset?.status === 'under_maintenance';

  return (
    <main className="min-h-screen bg-gray-950 text-sm">
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gray-800/40 px-4 py-3">
          <h1 className="text-base font-bold text-gray-100">Report an issue</h1>
          {displayName && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{displayName}</p>
          )}
        </div>

        {asset && (
          <Section title="Asset" accentClass="border-l-violet-500/50" titleClass="text-violet-400/80">
            <div className="grid grid-cols-2 gap-2">
              <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Name</p>
                <p className="text-xs font-medium text-gray-200 mt-0.5 truncate">{asset.name}</p>
              </div>
              <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">ID</p>
                <p className="text-xs font-medium text-gray-200 mt-0.5 truncate">{asset.assetId}</p>
              </div>
              <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Category</p>
                <p className="text-xs font-medium text-gray-200 mt-0.5">{asset.category}</p>
              </div>
              <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Status</p>
                <span
                  className={`inline-block mt-0.5 px-1.5 py-0.5 text-[9px] rounded border capitalize ${
                    STATUS_BADGE[asset.status] ?? STATUS_BADGE.retired
                  }`}
                >
                  {asset.status.replace('_', ' ')}
                </span>
              </div>
              {asset.departmentId && (
                <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0 col-span-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Department</p>
                  <p className="text-xs font-medium text-gray-200 mt-0.5">{asset.departmentId.name}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {isUnderMaintenance && (
          <Section title="Reporting unavailable" accentClass="border-l-amber-500/50" titleClass="text-amber-400/80">
            <div className="flex items-start gap-2">
              <span className="text-base">🔧</span>
              <div>
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
            <Link
              href={assetId ? `/a/${assetId}` : '/'}
              className={`${buttonClass} mt-3 block text-center no-underline w-full border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 py-2`}
            >
              ← Back to asset
            </Link>
          </Section>
        )}

        {!assetId && (
          <p className="text-[11px] text-amber-300 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
            No asset selected. Open this page from the asset QR code or link.
          </p>
        )}

        {!isUnderMaintenance && (
          <Section title="Your report" accentClass="border-l-emerald-500/50" titleClass="text-emerald-400/80">
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <p className="text-[11px] text-red-400 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
                  {error}
                </p>
              )}

              <Field label="Your name" required>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="e.g. John Smith"
                />
              </Field>

              <Field label="Email" required>
                <input
                  type="email"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </Field>

              <Field label="Phone" required>
                <input
                  type="tel"
                  value={reporterPhone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setReporterPhone(value);
                  }}
                  pattern="[0-9]{10}"
                  maxLength={10}
                  required
                  className={inputClass}
                  placeholder="e.g. 9876543210"
                />
              </Field>

              <Field label="What's the problem?" required>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">Select type</option>
                  {ISSUE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Description" required>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Describe the issue in a few lines..."
                />
              </Field>

              <button
                type="submit"
                disabled={loading || !assetId}
                className={`${buttonClass} w-full py-2.5 text-sm font-semibold border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30`}
              >
                {loading ? 'Submitting…' : 'Submit report'}
              </button>
            </form>
          </Section>
        )}

        {!isUnderMaintenance && (
          <Link
            href={assetId ? `/a/${assetId}` : '/'}
            className="text-center text-[11px] text-gray-500 hover:text-gray-300 no-underline"
          >
            ← Back to asset
          </Link>
        )}
      </div>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <LoadingSpinner message="Loading..." />
        </main>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
