import { apiUrl, authHeaders } from './api';

export type PartnerConfig = {
  partnerTypes: { id: string; name: string; isDefault?: boolean }[];
  categories: { id: string; name: string; isDefault?: boolean }[];
  statuses: { id: string; name: string; color?: string; isDefault?: boolean }[];
  profileSections: { key: string; label: string; enabled: boolean }[];
  addressTypes: { id: string; name: string; isDefault?: boolean }[];
  assetRelationshipTypes: { key: string; label: string }[];
  serviceRelationshipTypes: { key: string; label: string; resourceType?: string }[];
  customFields: {
    key: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
    section?: string;
  }[];
  performanceKpis: {
    key: string;
    label: string;
    unit?: string;
    higherIsBetter?: boolean;
    enabled?: boolean;
  }[];
  dashboardWidgetCatalog?: { key: string; label: string; kind: string }[];
  settings?: {
    partnerCodePrefix?: string;
    defaultCurrency?: string;
    defaultPaymentTerms?: string;
  };
};

export type BusinessPartner = {
  _id: string;
  partnerCode: string;
  vendorId?: string;
  name: string;
  partnerTypeKey?: string;
  categoryKey?: string;
  category?: string;
  status: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  notes?: string;
  paymentTerms?: string;
  creditLimit?: number | null;
  currency?: string;
  contactPerson?: string;
  primaryContact?: Record<string, string>;
  contacts?: {
    _id?: string;
    name: string;
    role?: string;
    department?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    whatsapp?: string;
    notes?: string;
    isPrimary?: boolean;
  }[];
  addresses?: {
    _id?: string;
    typeKey?: string;
    label?: string;
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    isPrimary?: boolean;
  }[];
  tags?: string[];
  customFields?: Record<string, unknown>;
  registrationDetails?: Record<string, unknown>;
  businessDetails?: Record<string, unknown>;
  bankDetails?: Record<string, unknown>;
  taxDetails?: Record<string, unknown>;
  assetCount?: number;
  invoiceCount?: number;
  totalPurchased?: number;
  pendingPayment?: number;
  contractCount?: number;
};

function bp(path: string) {
  return apiUrl(`/business-partners${path}`);
}

export async function fetchPartnerConfig(): Promise<PartnerConfig> {
  const res = await fetch(bp('/config'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load config');
  return data.config;
}

export async function updatePartnerConfig(payload: Partial<PartnerConfig>): Promise<PartnerConfig> {
  const res = await fetch(bp('/config'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to save config');
  return data.config;
}

export async function fetchPartners(params: Record<string, string> = {}): Promise<BusinessPartner[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(bp(qs ? `?${qs}` : ''), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load partners');
  return Array.isArray(data) ? data : data.partners || [];
}

export async function fetchPartner(id: string) {
  const res = await fetch(bp(`/${id}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load partner');
  return data;
}

export async function createPartner(body: Record<string, unknown>) {
  const res = await fetch(bp(''), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create partner');
  return data;
}

export async function updatePartner(id: string, body: Record<string, unknown>) {
  const res = await fetch(bp(`/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update partner');
  return data;
}

export async function deletePartner(id: string) {
  const res = await fetch(bp(`/${id}`), { method: 'DELETE', headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Failed to delete partner');
  return data;
}

export async function fetchPartnerSummary() {
  const res = await fetch(bp('/summary'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load summary');
  return data;
}

export async function fetchPartnerActivity(limit = 100) {
  const res = await fetch(bp(`/activity?limit=${limit}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load activity');
  return data.activities || [];
}

export async function fetchPartnerDashboards() {
  const res = await fetch(bp('/dashboards'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load dashboards');
  return data.dashboards || [];
}

export async function savePartnerDashboard(id: string | null, body: Record<string, unknown>) {
  const res = await fetch(bp(id ? `/dashboards/${id}` : '/dashboards'), {
    method: id ? 'PUT' : 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to save dashboard');
  return data.dashboard;
}

export async function partnerAction(path: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(bp(path), {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export function formatMoney(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
