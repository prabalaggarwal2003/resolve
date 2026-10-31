'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  DynamicIssueFormFields,
  isFieldVisible,
  type FormFieldDef,
} from '@/components/issues/DynamicIssueFormFields';

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

type IssueType = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  formFields?: FormFieldDef[];
};

type AssetPublicField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  order?: number;
  section?: string;
  readonly?: boolean;
  options?: string[];
  source?: string;
};

type OpenTicket = {
  _id?: string;
  ticketId: string;
  title: string;
  status: string;
  statusId?: string;
  issueTypeId?: string;
  createdAt: string;
  assigneeName?: string | null;
  reportCount?: number;
};

type ProgressInfo = {
  stages: { id: string; label: string }[];
  current: string;
  currentIndex: number;
  awaitingVerification?: boolean;
  statusLabel?: string;
};

type SuccessState = {
  merged: boolean;
  ticketId: string;
  reportId?: string;
  trackingToken?: string;
  trackUrl?: string;
  status?: string;
  assigneeName?: string | null;
  progress?: ProgressInfo;
  yourReport?: string;
  message: string;
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
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

function ProgressBar({ progress }: { progress?: ProgressInfo }) {
  if (!progress?.stages?.length) return null;
  return (
    <div className="mt-4 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Progress</p>
      <div className="flex flex-wrap gap-1.5">
        {progress.stages.map((stage, i) => {
          const done = i <= progress.currentIndex;
          const current = i === progress.currentIndex;
          return (
            <span
              key={stage.id}
              className={`px-2 py-0.5 text-[10px] rounded border ${
                current
                  ? 'border-blue-500/50 bg-blue-500/15 text-blue-200'
                  : done
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-gray-700/50 text-gray-600'
              }`}
            >
              {stage.label}
            </span>
          );
        })}
      </div>
      {progress.awaitingVerification && (
        <p className="text-[11px] text-amber-300/90 mt-2">Ticket is awaiting verification.</p>
      )}
    </div>
  );
}

function ReportContent() {
  const searchParams = useSearchParams();
  const assetId = searchParams.get('assetId') || '';
  const presetType = searchParams.get('type') || '';

  const [step, setStep] = useState<'identity' | 'otp' | 'type' | 'form' | 'choice'>('type');
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [openTickets, setOpenTickets] = useState<OpenTicket[]>([]);
  const [matchingTickets, setMatchingTickets] = useState<OpenTicket[]>([]);
  const [assetFields, setAssetFields] = useState<AssetPublicField[]>([]);
  const [assetFieldValues, setAssetFieldValues] = useState<Record<string, unknown>>({});
  const [editableAssetValues, setEditableAssetValues] = useState<Record<string, unknown>>({});
  const [asset, setAsset] = useState<{
    _id: string;
    name: string;
    assetId: string;
    category: string;
    status: string;
    locationId?: { name?: string };
    templateName?: string;
  } | null>(null);
  const [issueTypeId, setIssueTypeId] = useState(presetType);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [hasEmployeeRoster, setHasEmployeeRoster] = useState(false);
  const [identityLocked, setIdentityLocked] = useState(false);
  const [emailMasked, setEmailMasked] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [reportVerificationToken, setReportVerificationToken] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  const loadConfig = async (typeId?: string) => {
    const q = new URLSearchParams({ assetId });
    if (typeId) q.set('issueTypeId', typeId);
    const res = await fetch(api(`/api/public/report-config?${q}`));
    const data = await res.json();
    if (data.message && !data.asset) throw new Error(data.message);
    setAsset(data.asset);
    setIssueTypes(data.issueTypes || []);
    setOpenTickets(data.openTickets || []);
    setAssetFields(Array.isArray(data.assetFields) ? data.assetFields : []);
    const vals = data.assetFieldValues && typeof data.assetFieldValues === 'object' ? data.assetFieldValues : {};
    setAssetFieldValues(vals);
    const editable: Record<string, unknown> = {};
    for (const f of data.assetFields || []) {
      if (f.readonly === false) {
        editable[f.key] = vals[f.key] ?? '';
      }
    }
    setEditableAssetValues(editable);
    const rosterOn = data.hasEmployeeRoster === true;
    setHasEmployeeRoster(rosterOn);
    return { ...data, hasEmployeeRoster: rosterOn };
  };

  useEffect(() => {
    if (!assetId) {
      setBootLoading(false);
      return;
    }
    setBootLoading(true);
    loadConfig(presetType || undefined)
      .then((data) => {
        const def =
          presetType ||
          data.settings?.defaultIssueTypeId ||
          data.issueTypes?.find((t: IssueType) => t.isDefault)?.id ||
          data.issueTypes?.[0]?.id ||
          '';
        if (def) setIssueTypeId(def);
        // Employee ID step ONLY when a CSV/Excel roster was imported
        if (data.hasEmployeeRoster === true) {
          setStep('identity');
        } else if (presetType) {
          setStep('form');
        } else {
          setStep('type');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setBootLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, presetType]);

  const selectedType = useMemo(
    () => issueTypes.find((t) => t.id === issueTypeId) || null,
    [issueTypes, issueTypeId]
  );

  const fields = selectedType?.formFields || [];

  const setField = (key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const formatAssetValue = (field: AssetPublicField, raw: unknown): string => {
    if (raw == null || raw === '') return '—';
    if (field.key === 'status' && typeof raw === 'string') return raw.replace(/_/g, ' ');
    if (field.key === 'locationId' && typeof raw === 'object' && raw && 'name' in raw) {
      return String((raw as { name?: string }).name || '—');
    }
    if (field.key === 'departmentId' && typeof raw === 'object' && raw && 'name' in raw) {
      return String((raw as { name?: string }).name || '—');
    }
    if (field.key === 'vendorId' && typeof raw === 'object' && raw && 'name' in raw) {
      return String((raw as { name?: string }).name || '—');
    }
    if (Array.isArray(raw)) return raw.length ? raw.join(', ') : '—';
    return String(raw);
  };

  const sendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const body = hasEmployeeRoster
        ? { assetId, employeeId: employeeId.trim() }
        : {
            assetId,
            email: reporterEmail.trim(),
            name: reporterName.trim(),
          };
      const res = await fetch(api('/api/public/report/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send code');
      setEmailMasked(data.emailMasked || '');
      if (data.name) setReporterName(data.name);
      setDevOtpHint(data.devOtp ? String(data.devOtp) : '');
      if (data.devOtp) setOtpCode(String(data.devOtp));
      setOtpSent(true);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(api('/api/public/report/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          code: otpCode.trim(),
          email: reporterEmail.trim() || undefined,
          employeeId: employeeId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      setReportVerificationToken(data.reportVerificationToken);
      setReporterName(data.reporterName || reporterName);
      setReporterEmail(data.reporterEmail || reporterEmail);
      setReporterPhone(data.reporterPhone || reporterPhone);
      setEmployeeId(data.employeeId || employeeId);
      setEmailMasked(data.reporterEmailMasked || emailMasked);
      setEmailVerified(true);
      setIdentityLocked(hasEmployeeRoster);
      setOtpCode('');
      if (hasEmployeeRoster) setStep('type');
      else setStep('form');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const lookupEmployeeAndSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!employeeId.trim()) {
      setError('Employee ID is required');
      return;
    }
    setLoading(true);
    try {
      const lookupRes = await fetch(api('/api/public/report/lookup-employee'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, employeeId: employeeId.trim() }),
      });
      const lookup = await lookupRes.json();
      if (!lookupRes.ok) throw new Error(lookup.message || 'Employee not found');
      setReporterName(lookup.name || '');
      setEmailMasked(lookup.emailMasked || '');
      setReporterPhone(lookup.phone || '');

      const res = await fetch(api('/api/public/report/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, employeeId: employeeId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send code');
      setEmailMasked(data.emailMasked || lookup.emailMasked || '');
      if (data.name) setReporterName(data.name);
      setDevOtpHint(data.devOtp ? String(data.devOtp) : '');
      if (data.devOtp) setOtpCode(String(data.devOtp));
      setOtpSent(true);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const submitReport = async (existingTicketId?: string | null) => {
    setLoading(true);
    setError('');
    try {
      if (!reportVerificationToken) {
        throw new Error('Please verify your email before submitting');
      }
      for (const field of assetFields) {
        if (field.readonly !== false || !field.required) continue;
        const val = editableAssetValues[field.key];
        if (val == null || val === '' || (Array.isArray(val) && !val.length)) {
          throw new Error(`${field.label} is required`);
        }
      }
      const description = String(formValues.description || '').trim();
      const res = await fetch(api('/api/public/report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          reporterName: reporterName.trim(),
          reporterEmail: reporterEmail.trim(),
          reporterPhone: reporterPhone.trim() || undefined,
          employeeId: employeeId.trim() || undefined,
          reportVerificationToken,
          issueType: issueTypeId,
          description,
          formValues,
          priorityId: formValues.priority || undefined,
          assetFieldValues: editableAssetValues,
          ...(existingTicketId ? { existingTicketId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit');
      if (data.trackingToken && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`reportTrack:${data.trackingToken}`, JSON.stringify({
            reportId: data.reportId,
            ticketId: data.ticketId,
            at: Date.now(),
          }));
        } catch {
          /* ignore */
        }
      }
      setSuccess({
        merged: data.merged ?? false,
        ticketId: data.ticketId ?? '',
        reportId: data.reportId,
        trackingToken: data.trackingToken,
        trackUrl: data.trackUrl || (data.trackingToken ? `/track/${data.trackingToken}` : undefined),
        status: data.status,
        assigneeName: data.assigneeName,
        progress: data.progress,
        yourReport: data.yourReport || description,
        message: data.message ?? 'Thank you. Your report has been logged.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedType) {
      setError('Select an issue type');
      return;
    }

    for (const field of fields) {
      if (!isFieldVisible(field, formValues) || !field.required) continue;
      const val = formValues[field.key];
      if (val == null || val === '' || (Array.isArray(val) && !val.length)) {
        if (field.type === 'checkbox') continue;
        setError(`${field.label} is required`);
        return;
      }
    }
    if (!reporterName.trim() || !reporterEmail.trim()) {
      setError('Name and email are required');
      return;
    }

    if (!emailVerified || !reportVerificationToken) {
      await sendOtp();
      return;
    }

    setLoading(true);
    try {
      const data = await loadConfig(issueTypeId);
      const matches = (data.openTickets || []).filter(
        (t: OpenTicket) => !t.issueTypeId || t.issueTypeId === issueTypeId
      );
      setMatchingTickets(matches);
      if (matches.length > 0) {
        setStep('choice');
        setLoading(false);
        return;
      }
      await submitReport(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  if (success) {
    const trackHref = success.trackUrl || (success.trackingToken ? `/track/${success.trackingToken}` : null);
    const copyToken = async () => {
      if (!success.trackingToken) return;
      try {
        await navigator.clipboard.writeText(success.trackingToken);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
      } catch {
        /* fallback: select via prompt if clipboard blocked */
        window.prompt('Copy your tracking token:', success.trackingToken);
      }
    };
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-5 py-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-emerald-500/15 text-emerald-400 mb-3 text-lg">
              ✓
            </div>
            <h1 className="text-base font-bold text-gray-100 mb-1">Report submitted successfully</h1>
            <p className="text-xs text-gray-400 mb-4">{success.message}</p>
          </div>

          <div className="space-y-2 text-left rounded-lg border border-gray-700/40 bg-gray-900/40 px-3 py-3">
            {success.reportId && (
              <p className="text-xs text-gray-300">
                Report ID: <span className="font-mono text-gray-100">{success.reportId}</span>
              </p>
            )}
            {success.ticketId && (
              <p className="text-xs text-gray-300">
                Ticket: <span className="font-mono text-gray-100">{success.ticketId}</span>
              </p>
            )}
            <p className="text-xs text-gray-300">
              Status:{' '}
              <span className="capitalize text-gray-100">
                {success.progress?.statusLabel || (success.status || '').replace(/_/g, ' ') || 'Reported'}
              </span>
            </p>
            <p className="text-xs text-gray-300">
              Assigned to: <span className="text-gray-100">{success.assigneeName || 'Pending assignment'}</span>
            </p>
            {success.yourReport && (
              <div className="pt-2 border-t border-gray-800/80">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Your report</p>
                <p className="text-xs text-gray-200 whitespace-pre-wrap">&ldquo;{success.yourReport}&rdquo;</p>
              </div>
            )}
          </div>

          {success.trackingToken && (
            <div className="mt-3 rounded-lg border border-blue-500/25 bg-blue-500/5 px-3 py-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-300/80 mb-1">
                Tracking token
              </p>
              <p className="text-[11px] text-gray-400 mb-2">
                Save this token to check your report status later (Track my report).
              </p>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 min-w-0 break-all text-[11px] font-mono text-gray-100 bg-gray-900/60 border border-gray-700/50 rounded-lg px-2.5 py-2">
                  {success.trackingToken}
                </code>
                <button
                  type="button"
                  onClick={copyToken}
                  className={`${buttonClass} shrink-0 self-stretch px-3 border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30`}
                >
                  {tokenCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          <ProgressBar progress={success.progress} />

          <div className="flex flex-col gap-2 mt-5">
            {trackHref && (
              <Link
                href={trackHref}
                className={`${buttonClass} block text-center no-underline border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30 py-2.5`}
              >
                Track my report
              </Link>
            )}
            <Link
              href={assetId ? `/a/${assetId}` : '/'}
              className={`${buttonClass} block text-center no-underline border-gray-700/60 bg-gray-800/60 text-gray-200 hover:bg-gray-700/60 py-2`}
            >
              Back to asset
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (bootLoading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <LoadingSpinner message="Loading…" />
      </main>
    );
  }

  const isUnderMaintenance = asset?.status === 'under_maintenance';

  return (
    <main className="min-h-screen bg-gray-950 text-sm">
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gray-800/40 px-4 py-3">
          <h1 className="text-base font-bold text-gray-100">Report an issue</h1>
          {asset && <p className="text-xs text-gray-500 mt-0.5 truncate">{asset.name}</p>}
        </div>

        {asset && (
          <Section title="Asset" accentClass="border-l-violet-500/50" titleClass="text-violet-400/80">
            {asset.templateName && (
              <p className="text-[10px] text-gray-500 mb-2">Template: {asset.templateName}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {/* Always show identity */}
              <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">ID</p>
                <p className="text-xs font-medium text-gray-200 mt-0.5">{asset.assetId}</p>
              </div>
              <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Name</p>
                <p className="text-xs font-medium text-gray-200 mt-0.5 truncate">{asset.name}</p>
              </div>
              {assetFields
                .filter((f) => f.readonly !== false)
                .filter((f) => !['name', 'assetId'].includes(f.key))
                .map((field) => (
                  <div
                    key={field.key}
                    className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30"
                  >
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">{field.label}</p>
                    <p className="text-xs font-medium text-gray-200 mt-0.5 break-words capitalize">
                      {formatAssetValue(field, assetFieldValues[field.key])}
                    </p>
                  </div>
                ))}
            </div>
            {assetFields.some((f) => f.readonly === false) && (
              <div className="mt-3 space-y-2 border-t border-gray-800/80 pt-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Asset details to provide</p>
                {assetFields
                  .filter((f) => f.readonly === false)
                  .map((field) => (
                    <div key={field.key}>
                      <label className={labelClass}>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          className={inputClass}
                          rows={2}
                          value={String(editableAssetValues[field.key] ?? '')}
                          onChange={(e) =>
                            setEditableAssetValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          required={field.required}
                        />
                      ) : field.type === 'select' && field.options?.length ? (
                        <select
                          className={inputClass}
                          value={String(editableAssetValues[field.key] ?? '')}
                          onChange={(e) =>
                            setEditableAssetValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          required={field.required}
                        >
                          <option value="">Select…</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          className={inputClass}
                          value={String(editableAssetValues[field.key] ?? '')}
                          onChange={(e) =>
                            setEditableAssetValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          required={field.required}
                        />
                      )}
                    </div>
                  ))}
              </div>
            )}
          </Section>
        )}

        {openTickets.length > 0 && step !== 'choice' && (
          <Section title="Open tickets on this asset" accentClass="border-l-amber-500/50" titleClass="text-amber-400/80">
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {openTickets.map((t) => (
                <div key={t.ticketId} className="rounded-lg border border-gray-700/40 bg-gray-900/30 px-2.5 py-1.5">
                  <p className="text-[11px] font-mono text-gray-400">{t.ticketId}</p>
                  <p className="text-xs text-gray-200 truncate">{t.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 capitalize">
                    {(t.statusId || t.status || '').replace(/_/g, ' ')}
                    {t.assigneeName ? ` · ${t.assigneeName}` : ''}
                    {typeof t.reportCount === 'number' ? ` · ${t.reportCount} report${t.reportCount === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {isUnderMaintenance && (
          <Section title="Reporting unavailable" accentClass="border-l-amber-500/50" titleClass="text-amber-400/80">
            <p className="text-xs text-amber-200/90">
              This asset is under maintenance. Issue reporting is temporarily disabled.
            </p>
            <Link
              href={assetId ? `/a/${assetId}` : '/'}
              className={`${buttonClass} mt-3 block text-center no-underline w-full border-amber-500/30 bg-amber-500/10 text-amber-200 py-2`}
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

        {!isUnderMaintenance && assetId && step === 'identity' && (
          <Section
            title="Verify employee ID"
            accentClass="border-l-blue-500/50"
            titleClass="text-blue-400/80"
          >
            <p className="text-xs text-gray-400 mb-3">
              Enter your employee ID. We will send a verification code to the email on file.
            </p>
            {error && (
              <p className="text-[11px] text-red-400 mb-2 px-2 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
                {error}
              </p>
            )}
            <form onSubmit={lookupEmployeeAndSendOtp} className="space-y-3">
              <div>
                <label className={labelClass}>Employee ID *</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="e.g. EMP-1042"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`${buttonClass} w-full py-2.5 text-sm font-semibold border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30`}
              >
                {loading ? 'Looking up…' : 'Continue'}
              </button>
            </form>
          </Section>
        )}

        {!isUnderMaintenance && assetId && step === 'otp' && (
          <Section
            title="Email verification"
            accentClass="border-l-blue-500/50"
            titleClass="text-blue-400/80"
          >
            <p className="text-xs text-gray-400 mb-3">
              Enter the 6-digit code sent to{' '}
              <span className="text-gray-200">{emailMasked || 'your email'}</span>
              {reporterName ? (
                <>
                  {' '}
                  for <span className="text-gray-200">{reporterName}</span>
                </>
              ) : null}
              .
            </p>
            {devOtpHint && (
              <p className="text-[11px] text-amber-300 mb-2 px-2 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10">
                Email delivery unavailable in this environment. Use code:{' '}
                <span className="font-mono font-semibold tracking-widest">{devOtpHint}</span>
              </p>
            )}
            {error && (
              <p className="text-[11px] text-red-400 mb-2 px-2 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
                {error}
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Verification code *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputClass} tracking-[0.35em] text-center text-lg`}
                  placeholder="••••••"
                />
              </div>
              <button
                type="button"
                disabled={loading || otpCode.length !== 6}
                onClick={verifyOtp}
                className={`${buttonClass} w-full py-2.5 text-sm font-semibold border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30`}
              >
                {loading ? 'Verifying…' : 'Verify & continue'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={sendOtp}
                className="w-full text-[11px] text-gray-500 hover:text-gray-300"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(hasEmployeeRoster ? 'identity' : 'form');
                  setOtpCode('');
                  setError('');
                }}
                className="w-full text-[11px] text-gray-500 hover:text-gray-300"
              >
                ← Back
              </button>
            </div>
          </Section>
        )}

        {!isUnderMaintenance && assetId && step === 'type' && (
          <Section title="Select issue type" accentClass="border-l-emerald-500/50" titleClass="text-emerald-400/80">
            {error && (
              <p className="text-[11px] text-red-400 mb-2 px-2 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
                {error}
              </p>
            )}
            <div className="grid grid-cols-1 gap-2">
              {issueTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={async () => {
                    setIssueTypeId(t.id);
                    setFormValues({});
                    setStep('form');
                    setError('');
                    try {
                      await loadConfig(t.id);
                    } catch {
                      /* keep previous open tickets */
                    }
                  }}
                  className="text-left rounded-lg border border-gray-700/50 bg-gray-900/40 px-3 py-2.5 hover:border-gray-600/60 transition-colors"
                  style={{ borderLeftWidth: 3, borderLeftColor: t.color || '#6b7280' }}
                >
                  <p className="text-sm font-semibold text-gray-100">{t.name}</p>
                  {t.description && <p className="text-[11px] text-gray-500 mt-0.5">{t.description}</p>}
                </button>
              ))}
            </div>
          </Section>
        )}

        {!isUnderMaintenance && assetId && step === 'choice' && (
          <Section title="Existing issue found" accentClass="border-l-amber-500/50" titleClass="text-amber-400/80">
            <p className="text-xs text-gray-400 mb-3">
              An open ticket already exists for this asset and issue type. Add your report to it, or create a new ticket.
            </p>
            {error && (
              <p className="text-[11px] text-red-400 mb-2 px-2 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
                {error}
              </p>
            )}
            <div className="space-y-2 mb-3">
              {matchingTickets.map((t) => (
                <div key={t.ticketId} className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
                  <p className="text-xs font-mono text-amber-200/90">{t.ticketId}</p>
                  <p className="text-sm text-gray-100 mt-0.5">{t.title}</p>
                  <p className="text-[11px] text-gray-500 mt-1 capitalize">
                    {(t.statusId || t.status || '').replace(/_/g, ' ')}
                    {t.assigneeName ? ` · Already assigned to ${t.assigneeName}` : ' · Unassigned'}
                  </p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => submitReport(t.ticketId)}
                    className={`${buttonClass} mt-2.5 w-full py-2 border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30`}
                  >
                    {loading ? 'Submitting…' : 'Add my report to this ticket'}
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => submitReport(null)}
              className={`${buttonClass} w-full py-2 border-gray-600/50 bg-gray-800/60 text-gray-200 hover:bg-gray-700/60`}
            >
              {loading ? 'Submitting…' : 'Create a new ticket'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setStep('form');
                setError('');
              }}
              className="mt-2 w-full text-[11px] text-gray-500 hover:text-gray-300"
            >
              ← Back to form
            </button>
          </Section>
        )}

        {!isUnderMaintenance && assetId && step === 'form' && selectedType && (
          <Section
            title={`${selectedType.name} report`}
            accentClass="border-l-emerald-500/50"
            titleClass="text-emerald-400/80"
          >
            <button
              type="button"
              onClick={() => setStep('type')}
              className="text-[11px] text-blue-400 hover:underline mb-3"
            >
              ← Change issue type
            </button>
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <p className="text-[11px] text-red-400 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
                  {error}
                </p>
              )}

              {emailVerified && (
                <p className="text-[11px] text-emerald-400/90 px-2 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  Email verified{emailMasked ? ` (${emailMasked})` : ''}. You can submit your report.
                </p>
              )}

              <div>
                <label className={labelClass}>Your name *</label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => {
                    setReporterName(e.target.value);
                    if (!hasEmployeeRoster) {
                      setEmailVerified(false);
                      setReportVerificationToken('');
                    }
                  }}
                  required
                  readOnly={identityLocked}
                  className={`${inputClass} ${identityLocked ? 'opacity-80' : ''}`}
                  placeholder="e.g. John Smith"
                />
              </div>
              <div>
                <label className={labelClass}>Email *</label>
                <input
                  type="email"
                  value={reporterEmail}
                  onChange={(e) => {
                    setReporterEmail(e.target.value);
                    if (!hasEmployeeRoster) {
                      setEmailVerified(false);
                      setReportVerificationToken('');
                    }
                  }}
                  required
                  readOnly={identityLocked}
                  className={`${inputClass} ${identityLocked ? 'opacity-80' : ''}`}
                  placeholder="you@example.com"
                />
              </div>
              {!hasEmployeeRoster ? null : employeeId ? (
                <div>
                  <label className={labelClass}>Employee ID</label>
                  <input type="text" value={employeeId} readOnly className={`${inputClass} opacity-80`} />
                </div>
              ) : null}
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="tel"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  readOnly={identityLocked && Boolean(reporterPhone)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>

              <DynamicIssueFormFields fields={fields} values={formValues} onChange={setField} />

              <button
                type="submit"
                disabled={loading || (emailVerified && !reportVerificationToken)}
                className={`${buttonClass} w-full py-2.5 text-sm font-semibold border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30`}
              >
                {loading
                  ? 'Please wait…'
                  : emailVerified
                    ? 'Submit report'
                    : 'Verify email to submit'}
              </button>
            </form>
          </Section>
        )}

        {!isUnderMaintenance && (
          <div className="flex flex-col items-center gap-2">
            <Link
              href={assetId ? `/a/${assetId}?track=1` : '/track'}
              className="text-center text-[11px] text-blue-400 hover:text-blue-300 no-underline"
            >
              Track my report
            </Link>
            <Link
              href={assetId ? `/a/${assetId}` : '/'}
              className="text-center text-[11px] text-gray-500 hover:text-gray-300 no-underline"
            >
              ← Back to asset
            </Link>
          </div>
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
