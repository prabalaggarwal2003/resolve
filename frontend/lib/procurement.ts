import { api, authHeaders, formatBudgetCurrency } from './budgets';

export type ProcurementLifecycleStage = {
  id: string;
  name: string;
  color?: string;
  bucket: 'planned' | 'committed' | 'actual' | 'cancelled';
  isDefault?: boolean;
};

export type ProcurementPaymentStatus = {
  id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
};

export type ProcurementCustomField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'textarea' | 'currency';
  required?: boolean;
  options?: string[];
  section?: string;
};

export type Procurement = {
  _id: string;
  purchaseId: string;
  purchaseOrderNumber?: string;
  invoiceNumber?: string;
  vendorId?: { _id: string; name: string; vendorId?: string } | string;
  purchaseDate?: string;
  budgetId?: { _id: string; name: string; code?: string; currency?: string } | string;
  departmentId?: { _id: string; name: string } | string;
  amount: number;
  tax: number;
  discount: number;
  shipping: number;
  totalCost: number;
  lifecycleStage: string;
  paymentStatus: string;
  fundingSourceId?: string;
  costCenter?: string;
  project?: string;
  dimensions?: Record<string, string>;
  customFields?: Record<string, string | number | string[]>;
  attachments?: { url: string; name: string; uploadedAt?: string }[];
  notes?: string;
  assetIds?: { _id: string; assetId: string; name: string; cost?: number; status?: string }[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProcurementSummary = {
  totalRecords: number;
  plannedSpend: number;
  committedSpend: number;
  actualSpend: number;
  pendingCount: number;
};

export { api, authHeaders, formatBudgetCurrency };

export function computeProcurementTotal(
  amount: number,
  tax: number,
  discount: number,
  shipping: number
) {
  return Math.max(0, amount + tax - discount + shipping);
}

export async function fetchProcurementSummary(): Promise<ProcurementSummary> {
  const res = await fetch(api('/api/procurement/summary'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load procurement summary');
  return data.summary;
}

export async function fetchProcurements(params: Record<string, string> = {}): Promise<Procurement[]> {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(api(`/api/procurement${q ? `?${q}` : ''}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load procurement records');
  return data.procurements || [];
}

export async function fetchProcurement(id: string): Promise<Procurement> {
  const res = await fetch(api(`/api/procurement/${id}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load procurement record');
  return data.procurement;
}

export async function createProcurement(payload: Partial<Procurement>): Promise<Procurement> {
  const res = await fetch(api('/api/procurement'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create procurement');
  return data.procurement;
}

import type { BudgetHistoryChange } from './budgets';

export async function updateProcurement(
  id: string,
  payload: Partial<Procurement>
): Promise<{ procurement: Procurement; changes: BudgetHistoryChange[] }> {
  const res = await fetch(api(`/api/procurement/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update procurement');
  return { procurement: data.procurement, changes: data.changes || [] };
}

export async function deleteProcurement(id: string): Promise<void> {
  const res = await fetch(api(`/api/procurement/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete procurement');
}

export async function linkAssetToProcurement(procurementId: string, assetId: string): Promise<Procurement> {
  const res = await fetch(api(`/api/procurement/${procurementId}/link-asset`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ assetId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to link asset');
  return data.procurement;
}
