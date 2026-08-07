export const TIME_ZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
  { value: 'America/Denver', label: 'America/Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST)' },
  { value: 'UTC', label: 'UTC' },
] as const;

export const CURRENCIES = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'CNY', label: 'CNY — Chinese Yuan' },
  { value: 'CHF', label: 'CHF — Swiss Franc' },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'MXN', label: 'MXN — Mexican Peso' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'THB', label: 'THB — Thai Baht' },
  { value: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { value: 'PHP', label: 'PHP — Philippine Peso' },
] as const;

export const ORG_ADDRESS_TYPES = [
  { value: 'head_office', label: 'Head office' },
  { value: 'registered', label: 'Registered office' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'branch', label: 'Branch' },
  { value: 'billing', label: 'Billing' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'other', label: 'Other' },
] as const;

export function formatOrgAddressLabel(address?: {
  label?: string;
  typeKey?: string;
  city?: string;
  street?: string;
} | null): string {
  if (!address) return '—';
  const typeLabel =
    ORG_ADDRESS_TYPES.find((t) => t.value === address.typeKey)?.label || address.typeKey || 'Address';
  const name = address.label?.trim() || typeLabel;
  const place = [address.city, address.street].filter(Boolean).join(', ');
  return place ? `${name} — ${place}` : name;
}
