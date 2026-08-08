'use client';

import Link from 'next/link';
import { formatOrgDateTime } from '@/lib/orgTimezone';

type ActivityChange = {
  field?: string;
  label?: string;
  from?: string;
  to?: string;
};

export type PartnerActivityItem = {
  id?: string;
  _id?: string;
  type?: string;
  summary?: string;
  partnerId?: string | { _id?: string; name?: string };
  partnerName?: string;
  partnerCode?: string;
  userName?: string;
  changes?: ActivityChange[];
  details?: { changes?: ActivityChange[]; text?: string };
  createdAt?: string;
};

function activityKey(a: PartnerActivityItem, index: number) {
  return a.id || a._id || `activity-${index}`;
}

function partnerHref(a: PartnerActivityItem) {
  if (!a.partnerId) return null;
  if (typeof a.partnerId === 'object') return a.partnerId._id || null;
  return a.partnerId;
}

function partnerLabel(a: PartnerActivityItem) {
  if (a.partnerName) return a.partnerName;
  if (typeof a.partnerId === 'object' && a.partnerId?.name) return a.partnerId.name;
  return a.partnerCode || 'Partner';
}

function changesFor(a: PartnerActivityItem): ActivityChange[] {
  if (Array.isArray(a.changes) && a.changes.length) return a.changes;
  if (Array.isArray(a.details?.changes)) return a.details!.changes!;
  return [];
}

export default function PartnerActivityList({
  activities,
  showPartner = true,
  emptyMessage = 'No activity yet',
  maxHeightClass = '',
}: {
  activities: PartnerActivityItem[];
  showPartner?: boolean;
  emptyMessage?: string;
  maxHeightClass?: string;
}) {
  return (
    <ul className={`space-y-3 ${maxHeightClass}`.trim()}>
      {activities.length === 0 && <li className="text-xs text-gray-500">{emptyMessage}</li>}
      {activities.map((a, index) => {
        const href = partnerHref(a);
        const changes = changesFor(a);
        return (
          <li key={activityKey(a, index)} className="text-xs text-gray-300 border-b border-gray-800/80 pb-3 last:border-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-gray-500">
              <span>{a.createdAt ? formatOrgDateTime(a.createdAt) : '—'}</span>
              <span>·</span>
              <span className="uppercase tracking-wide text-[10px]">{a.type || 'event'}</span>
              <span>·</span>
              <span className="text-gray-400">by {a.userName || 'System'}</span>
            </div>
            <div className="mt-1 text-gray-200">
              {showPartner && href ? (
                <>
                  <Link href={`/dashboard/partners/${href}`} className="text-blue-300 no-underline font-medium">
                    {partnerLabel(a)}
                  </Link>
                  {a.partnerCode ? <span className="text-gray-500 ml-1 font-mono text-[10px]">({a.partnerCode})</span> : null}
                  <span className="text-gray-600"> — </span>
                </>
              ) : showPartner && a.partnerName ? (
                <>
                  <span className="font-medium text-gray-100">{a.partnerName}</span>
                  <span className="text-gray-600"> — </span>
                </>
              ) : null}
              <span>{a.summary}</span>
            </div>
            {changes.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 pl-0">
                {changes.map((c, i) => (
                  <li key={`${c.field || c.label}-${i}`} className="text-[11px] text-gray-400">
                    <span className="text-gray-300">{c.label || c.field || 'Field'}</span>
                    {': '}
                    <span className="text-red-300/80">{c.from ?? '(empty)'}</span>
                    <span className="text-gray-600"> → </span>
                    <span className="text-emerald-300/90">{c.to ?? '(empty)'}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
