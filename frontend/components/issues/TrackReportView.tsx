'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50';

type TrackPayload = {
  reportId?: string;
  ticketId?: string;
  title?: string;
  status?: string;
  statusName?: string;
  assigneeName?: string | null;
  lastUpdated?: string;
  asset?: { name?: string; assetId?: string } | null;
  yourReport?: {
    description?: string;
    createdAt?: string;
    status?: string;
    acknowledgedAt?: string | null;
    photos?: { url: string }[];
    followUps?: { note: string; createdAt?: string }[];
  };
  progress?: {
    stages: { id: string; label: string }[];
    current: string;
    currentIndex: number;
    awaitingVerification?: boolean;
    statusLabel?: string;
  };
  trackingToken?: string;
  message?: string;
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function formatWhen(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function TrackContent({ initialToken = '' }: { initialToken?: string }) {
  const searchParams = useSearchParams();
  const tokenFromQuery = searchParams.get('token') || '';
  const assetId = searchParams.get('assetId') || '';

  const [tokenInput, setTokenInput] = useState(initialToken || tokenFromQuery);
  const [data, setData] = useState<TrackPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(initialToken || tokenFromQuery));
  const [error, setError] = useState('');
  const [attentionNote, setAttentionNote] = useState('');
  const [attentionMsg, setAttentionMsg] = useState('');
  const [sendingAttention, setSendingAttention] = useState(false);

  const load = async (token: string) => {
    const t = token.trim();
    if (!t) {
      setError('Enter your tracking token');
      return;
    }
    setLoading(true);
    setError('');
    setAttentionMsg('');
    try {
      const res = await fetch(api(`/api/public/track/${encodeURIComponent(t)}`));
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Report not found');
      setData(json);
      setTokenInput(t);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = initialToken || tokenFromQuery;
    if (initial) load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken, tokenFromQuery]);

  const requestAttention = async () => {
    const token = data?.trackingToken || tokenInput;
    if (!token) return;
    setSendingAttention(true);
    setAttentionMsg('');
    try {
      const res = await fetch(api(`/api/public/track/${encodeURIComponent(token)}/attention`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: attentionNote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to send');
      setAttentionMsg(json.message || 'Request sent');
      setAttentionNote('');
      await load(token);
    } catch (err) {
      setAttentionMsg(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSendingAttention(false);
    }
  };

  const showResolvedActions = Boolean(
    data &&
      (data.progress?.awaitingVerification ||
        data.progress?.current === 'resolved' ||
        data.progress?.current === 'closed' ||
        ['resolved', 'verified', 'closed'].includes(String(data.status || '')))
  );

  return (
    <main className="min-h-screen bg-gray-950 text-sm">
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gray-800/40 px-4 py-3">
          <h1 className="text-base font-bold text-gray-100">Track my report</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Use the secure tracking link or token from your submission confirmation.
          </p>
        </div>

        {!initialToken && (
          <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-3 py-3 space-y-2">
            <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Tracking token
            </label>
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.trim())}
              className={inputClass}
              placeholder="Paste your tracking token"
              autoComplete="off"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => load(tokenInput)}
              className={`${buttonClass} w-full py-2 border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30`}
            >
              {loading ? 'Looking up…' : 'View status'}
            </button>
          </div>
        )}

        {loading && !data && <LoadingSpinner message="Loading report…" />}

        {error && (
          <p className="text-[11px] text-red-400 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
            {error}
          </p>
        )}

        {data && (
          <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/40 bg-gray-800/40 px-4 py-4 space-y-3">
            <div className="space-y-1.5">
              {data.reportId && (
                <p className="text-xs text-gray-300">
                  Report ID: <span className="font-mono text-gray-100">{data.reportId}</span>
                </p>
              )}
              {data.ticketId && (
                <p className="text-xs text-gray-300">
                  Ticket: <span className="font-mono text-gray-100">{data.ticketId}</span>
                  {data.title ? <span className="text-gray-500"> — {data.title}</span> : null}
                </p>
              )}
              {data.asset?.name && (
                <p className="text-xs text-gray-500">
                  Asset: {data.asset.name}
                  {data.asset.assetId ? ` (${data.asset.assetId})` : ''}
                </p>
              )}
              <p className="text-xs text-gray-300">
                Status:{' '}
                <span className="text-gray-100">
                  {data.progress?.statusLabel || data.statusName || (data.status || '').replace(/_/g, ' ')}
                </span>
              </p>
              <p className="text-xs text-gray-300">
                Assigned to: <span className="text-gray-100">{data.assigneeName || 'Pending assignment'}</span>
              </p>
              <p className="text-xs text-gray-500">Last updated: {formatWhen(data.lastUpdated)}</p>
            </div>

            {data.yourReport?.description && (
              <div className="rounded-lg border border-gray-700/40 bg-gray-900/40 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Your report</p>
                  {data.yourReport.status === 'acknowledged' ? (
                    <span className="px-1.5 py-0.5 text-[9px] rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                      Acknowledged
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[9px] rounded border border-amber-500/40 bg-amber-500/10 text-amber-200">
                      Received
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-200 whitespace-pre-wrap">
                  &ldquo;{data.yourReport.description}&rdquo;
                </p>
                {data.yourReport.createdAt && (
                  <p className="text-[10px] text-gray-600 mt-1.5">
                    Submitted {formatWhen(data.yourReport.createdAt)}
                  </p>
                )}
                {data.yourReport.status === 'acknowledged' && data.yourReport.acknowledgedAt && (
                  <p className="text-[10px] text-emerald-400/80 mt-0.5">
                    Acknowledged by the team · {formatWhen(data.yourReport.acknowledgedAt)}
                  </p>
                )}
                {(data.yourReport.followUps || []).length > 0 && (
                  <div className="mt-2.5 space-y-1.5 border-t border-gray-800/80 pt-2">
                    <p className="text-[10px] uppercase tracking-wide text-amber-400/80">
                      Problem still reported
                    </p>
                    {data.yourReport.followUps!.map((f, i) => (
                      <div
                        key={i}
                        className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5"
                      >
                        <p className="text-[11px] text-gray-200 whitespace-pre-wrap">{f.note}</p>
                        {f.createdAt && (
                          <p className="text-[10px] text-gray-500 mt-1">{formatWhen(f.createdAt)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(data.yourReport.photos || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.yourReport.photos!.map((p, i) => (
                      <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className="h-14 w-14 object-cover rounded border border-gray-700/60" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {data.progress?.stages?.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Progress</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.progress.stages.map((stage, i) => {
                    const done = i <= data.progress!.currentIndex;
                    const current = i === data.progress!.currentIndex;
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
                {data.progress.awaitingVerification && (
                  <p className="text-[11px] text-amber-300/90 mt-2">Awaiting verification</p>
                )}
              </div>
            ) : null}

            {showResolvedActions && (
              <div className="pt-2 border-t border-gray-800/80 space-y-2">
                <p className="text-[11px] text-gray-500">
                  Still seeing the problem? Request attention without creating a duplicate ticket.
                </p>
                <textarea
                  value={attentionNote}
                  onChange={(e) => setAttentionNote(e.target.value)}
                  rows={2}
                  required
                  className={inputClass}
                  placeholder="Describe what is still wrong"
                />
                <button
                  type="button"
                  disabled={sendingAttention || !attentionNote.trim()}
                  onClick={requestAttention}
                  className={`${buttonClass} w-full py-2 border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`}
                >
                  {sendingAttention ? 'Sending…' : 'Request attention'}
                </button>
                {attentionMsg && <p className="text-[11px] text-gray-400">{attentionMsg}</p>}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          {assetId && (
            <Link
              href={`/report?assetId=${assetId}`}
              className="text-[11px] text-blue-400 hover:text-blue-300 no-underline"
            >
              Report an issue
            </Link>
          )}
          <Link
            href={assetId ? `/a/${assetId}` : '/'}
            className="text-[11px] text-gray-500 hover:text-gray-300 no-underline"
          >
            ← Back
          </Link>
        </div>
      </div>
    </main>
  );
}

function TrackPageInner({ initialToken }: { initialToken?: string }) {
  return <TrackContent initialToken={initialToken} />;
}

export function TrackPageShell({ initialToken = '' }: { initialToken?: string }) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <LoadingSpinner message="Loading..." />
        </main>
      }
    >
      <TrackPageInner initialToken={initialToken} />
    </Suspense>
  );
}
