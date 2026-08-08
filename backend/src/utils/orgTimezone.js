import Organization from '../models/Organization.js';

export const DEFAULT_ORG_TIMEZONE = 'Asia/Kolkata';
export const ORG_DATE_LOCALE = 'en-IN';

export function normalizeOrgTimezone(value) {
  const tz = String(value || '').trim();
  if (!tz) return DEFAULT_ORG_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_ORG_TIMEZONE;
  }
}

export async function getOrganizationTimezone(organizationId) {
  if (!organizationId) return DEFAULT_ORG_TIMEZONE;
  const org = await Organization.findById(organizationId).select('timezone').lean();
  return normalizeOrgTimezone(org?.timezone);
}

function toDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isCalendarDateOnly(value, d) {
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
    if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?(Z|[+-]00:00)$/.test(s)) return true;
  }
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

function formatWithZone(d, timeZone, options) {
  try {
    return new Intl.DateTimeFormat(ORG_DATE_LOCALE, { ...options, timeZone }).format(d);
  } catch {
    try {
      return new Intl.DateTimeFormat(ORG_DATE_LOCALE, options).format(d);
    } catch {
      return d.toISOString();
    }
  }
}

export function formatOrgDate(value, timezone = DEFAULT_ORG_TIMEZONE, options = {}) {
  const d = toDate(value);
  if (!d) return '—';
  const opts = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  };
  if (isCalendarDateOnly(value, d)) {
    return formatWithZone(d, 'UTC', opts);
  }
  return formatWithZone(d, normalizeOrgTimezone(timezone), opts);
}

export function formatOrgDateTime(value, timezone = DEFAULT_ORG_TIMEZONE, options = {}) {
  const d = toDate(value);
  if (!d) return '—';
  return formatWithZone(d, normalizeOrgTimezone(timezone), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function orgTodayYmd(timezone = DEFAULT_ORG_TIMEZONE) {
  return orgCalendarYmd(new Date(), timezone);
}

export function orgCalendarYmd(value, timezone = DEFAULT_ORG_TIMEZONE) {
  const d = toDate(value) || new Date();
  const tz = normalizeOrgTimezone(timezone);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch {
    /* fall through */
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Convert a calendar YYYY-MM-DD in the given IANA timezone to a UTC Date
 * at that day's local midnight.
 */
export function orgStartOfDay(ymd, timezone = DEFAULT_ORG_TIMEZONE) {
  const tz = normalizeOrgTimezone(timezone);
  const day = String(ymd || orgTodayYmd(tz)).slice(0, 10);
  const utcGuess = new Date(`${day}T00:00:00.000Z`);
  // Difference between "UTC reading of wall clock in tz" and true UTC
  const asInTz = new Date(utcGuess.toLocaleString('en-US', { timeZone: tz }));
  const diff = utcGuess.getTime() - asInTz.getTime();
  return new Date(utcGuess.getTime() + diff);
}
