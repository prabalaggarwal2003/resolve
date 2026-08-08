/** Organization timezone — single source of truth for date/time display across the UI. */

export const ORG_TIMEZONE_STORAGE_KEY = 'orgTimezone';
export const ORG_TIMEZONE_EVENT = 'org-timezone-updated';
export const DEFAULT_ORG_TIMEZONE = 'Asia/Kolkata';
export const ORG_DATE_LOCALE = 'en-IN';

export function normalizeOrgTimezone(value?: string | null): string {
  const tz = String(value || '').trim();
  if (!tz) return DEFAULT_ORG_TIMEZONE;
  try {
    // Throws RangeError for invalid IANA zones
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_ORG_TIMEZONE;
  }
}

export function getOrgTimezone(): string {
  if (typeof window === 'undefined') return DEFAULT_ORG_TIMEZONE;
  try {
    return normalizeOrgTimezone(localStorage.getItem(ORG_TIMEZONE_STORAGE_KEY));
  } catch {
    return DEFAULT_ORG_TIMEZONE;
  }
}

export function setOrgTimezone(timezone: string | null | undefined) {
  if (typeof window === 'undefined') return normalizeOrgTimezone(timezone);
  const next = normalizeOrgTimezone(timezone);
  try {
    const prev = localStorage.getItem(ORG_TIMEZONE_STORAGE_KEY);
    localStorage.setItem(ORG_TIMEZONE_STORAGE_KEY, next);
    if (prev !== next) {
      window.dispatchEvent(new CustomEvent(ORG_TIMEZONE_EVENT, { detail: next }));
    }
  } catch {
    /* ignore storage errors */
  }
  return next;
}

export function clearOrgTimezone() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ORG_TIMEZONE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(ORG_TIMEZONE_EVENT, { detail: DEFAULT_ORG_TIMEZONE }));
  } catch {
    /* ignore */
  }
}

export function subscribeOrgTimezone(listener: (timezone: string) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<string>).detail;
    listener(normalizeOrgTimezone(detail || getOrgTimezone()));
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === ORG_TIMEZONE_STORAGE_KEY) listener(getOrgTimezone());
  };
  window.addEventListener(ORG_TIMEZONE_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ORG_TIMEZONE_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Calendar / date-only values (YYYY-MM-DD or UTC midnight from date inputs)
 * should not shift day when the org timezone is west of UTC.
 */
function isCalendarDateOnly(value: string | number | Date | null | undefined, d: Date): boolean {
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

function formatWithZone(
  d: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
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

/** Format a date (day/month/year) using the organization timezone. */
export function formatOrgDate(
  value: string | number | Date | null | undefined,
  timezone?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = toDate(value);
  if (!d) return '—';
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  };
  // Date-only fields keep their calendar day (UTC), not wall-clock shift
  if (isCalendarDateOnly(value, d)) {
    return formatWithZone(d, 'UTC', opts);
  }
  return formatWithZone(d, normalizeOrgTimezone(timezone || getOrgTimezone()), opts);
}

/** Format date + time using the organization timezone. */
export function formatOrgDateTime(
  value: string | number | Date | null | undefined,
  timezone?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = toDate(value);
  if (!d) return '—';
  return formatWithZone(d, normalizeOrgTimezone(timezone || getOrgTimezone()), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

/** Compact datetime for activity feeds / widgets. */
export function formatOrgDateTimeShort(
  value: string | number | Date | null | undefined,
  timezone?: string | null
): string {
  return formatOrgDateTime(value, timezone, {
    year: undefined,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Time only (hour:minute) in the organization timezone. */
export function formatOrgTime(
  value: string | number | Date | null | undefined,
  timezone?: string | null
): string {
  const d = toDate(value);
  if (!d) return '—';
  return formatWithZone(d, normalizeOrgTimezone(timezone || getOrgTimezone()), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Today's calendar date in the org timezone as YYYY-MM-DD. */
export function orgTodayYmd(timezone?: string | null): string {
  return orgCalendarYmd(new Date(), timezone);
}

/** Calendar YYYY-MM-DD for a timestamp in the org timezone. */
export function orgCalendarYmd(
  value: string | number | Date | null | undefined,
  timezone?: string | null
): string {
  const d = toDate(value) || new Date();
  const tz = normalizeOrgTimezone(timezone || getOrgTimezone());
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
