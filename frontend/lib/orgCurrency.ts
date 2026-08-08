/** Organization currency — single source of truth for money formatting across the UI. */

export const ORG_CURRENCY_STORAGE_KEY = 'orgCurrency';
export const ORG_CURRENCY_EVENT = 'org-currency-updated';
export const DEFAULT_ORG_CURRENCY = 'INR';

export function normalizeOrgCurrency(value?: string | null): string {
  const code = String(value || '')
    .trim()
    .toUpperCase();
  return code || DEFAULT_ORG_CURRENCY;
}

export function getOrgCurrency(): string {
  if (typeof window === 'undefined') return DEFAULT_ORG_CURRENCY;
  try {
    return normalizeOrgCurrency(localStorage.getItem(ORG_CURRENCY_STORAGE_KEY));
  } catch {
    return DEFAULT_ORG_CURRENCY;
  }
}

export function setOrgCurrency(currency: string | null | undefined) {
  if (typeof window === 'undefined') return normalizeOrgCurrency(currency);
  const next = normalizeOrgCurrency(currency);
  try {
    const prev = localStorage.getItem(ORG_CURRENCY_STORAGE_KEY);
    localStorage.setItem(ORG_CURRENCY_STORAGE_KEY, next);
    if (prev !== next) {
      window.dispatchEvent(new CustomEvent(ORG_CURRENCY_EVENT, { detail: next }));
    }
  } catch {
    /* ignore storage errors */
  }
  return next;
}

export function clearOrgCurrency() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ORG_CURRENCY_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(ORG_CURRENCY_EVENT, { detail: DEFAULT_ORG_CURRENCY }));
  } catch {
    /* ignore */
  }
}

export function subscribeOrgCurrency(listener: (currency: string) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<string>).detail;
    listener(normalizeOrgCurrency(detail || getOrgCurrency()));
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === ORG_CURRENCY_STORAGE_KEY) listener(getOrgCurrency());
  };
  window.addEventListener(ORG_CURRENCY_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ORG_CURRENCY_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Format a money amount using the organization currency (or an explicit override).
 */
export function formatOrgMoney(
  amount: number | null | undefined,
  currency?: string | null,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  const code = normalizeOrgCurrency(currency || getOrgCurrency());
  const value = Number(amount);
  const n = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: options?.maximumFractionDigits ?? 0,
      ...(options?.minimumFractionDigits != null
        ? { minimumFractionDigits: options.minimumFractionDigits }
        : {}),
    }).format(n);
  } catch {
    return `${code} ${n.toLocaleString('en-IN')}`;
  }
}

/** Currency symbol for the org currency (e.g. ₹, $, €). */
export function getOrgCurrencySymbol(currency?: string | null): string {
  const code = normalizeOrgCurrency(currency || getOrgCurrency());
  try {
    const parts = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value || code;
  } catch {
    return code;
  }
}
