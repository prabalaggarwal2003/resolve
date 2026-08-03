/** Shared warranty window used by KPI, home, depreciation, and insights. */
export const WARRANTY_EXPIRING_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Fractional days until warranty expiry (negative if already expired). */
export function daysUntilWarrantyExpiry(expiry, now = new Date()) {
  if (!expiry) return null;
  return (new Date(expiry).getTime() - now.getTime()) / MS_PER_DAY;
}

/**
 * Classify warranty coverage.
 * - none: no expiry date
 * - expired: at or past expiry
 * - expiring: still valid but within the alert window (default 30 days)
 * - active: valid and outside the alert window
 */
export function getWarrantyStatus(expiry, now = new Date(), windowDays = WARRANTY_EXPIRING_DAYS) {
  const days = daysUntilWarrantyExpiry(expiry, now);
  if (days == null) return 'none';
  if (days <= 0) return 'expired';
  if (days <= windowDays) return 'expiring';
  return 'active';
}

export function isWarrantyExpiringSoon(expiry, windowDays = WARRANTY_EXPIRING_DAYS, now = new Date()) {
  return getWarrantyStatus(expiry, now, windowDays) === 'expiring';
}

export function isWarrantyExpired(expiry, now = new Date()) {
  return getWarrantyStatus(expiry, now) === 'expired';
}

export function isUnderWarranty(expiry, now = new Date()) {
  const status = getWarrantyStatus(expiry, now);
  return status === 'active' || status === 'expiring';
}
