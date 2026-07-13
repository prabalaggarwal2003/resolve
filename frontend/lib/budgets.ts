export function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export type BudgetOption = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  isClosed?: boolean;
};

export type BudgetDimension = {
  key: string;
  label: string;
  enabled: boolean;
  required: boolean;
};

export type BudgetCustomField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'textarea' | 'currency';
  required?: boolean;
  options?: string[];
  section?: string;
};

export type ProcurementLifecycleStage = {
  id: string;
  name: string;
  color?: string;
  bucket: 'planned' | 'committed' | 'actual' | 'cancelled';
  isDefault?: boolean;
};

export type BudgetOrgConfig = {
  budgetTypes: BudgetOption[];
  budgetStatuses: BudgetOption[];
  fundingSources: BudgetOption[];
  enabledDimensions: BudgetDimension[];
  customFields: BudgetCustomField[];
  procurementLifecycleStages: ProcurementLifecycleStage[];
  procurementPaymentStatuses: BudgetOption[];
  procurementCustomFields: BudgetCustomField[];
  settings: {
    autoUpdateOnAssetCreate: boolean;
    autoUpdateOnPurchaseApprove: boolean;
    warnThresholdPct: number;
    criticalThresholdPct: number;
  };
};

export type Budget = {
  _id: string;
  name: string;
  code?: string;
  budgetTypeId: string;
  financialYear?: string;
  periodLabel?: string;
  startDate?: string;
  endDate?: string;
  allocatedAmount: number;
  currency: string;
  budgetOwnerId?: { _id: string; name: string; email?: string } | string;
  description?: string;
  status: string;
  notes?: string;
  dimensions: Record<string, string>;
  customFields: Record<string, string | number | string[]>;
  plannedAmount: number;
  committedAmount: number;
  actualSpend: number;
  remainingAmount: number;
  availableBalance: number;
  utilizationPct: number;
  createdAt?: string;
  updatedAt?: string;
};

export type BudgetSummary = {
  totalBudget: number;
  totalSpend: number;
  remainingBudget: number;
  utilizationPct: number;
  activeBudgets: number;
  totalBudgets: number;
  budgetsNearLimit: number;
  budgetsExceeded: number;
  pendingPurchaseRequests: number;
};

export type BudgetHistoryChange = {
  field: string;
  label: string;
  from: unknown;
  to: unknown;
};

export type BudgetHistoryEntry = {
  _id: string;
  entityType?: 'budget' | 'procurement';
  eventType: string;
  label: string;
  description: string;
  changes?: BudgetHistoryChange[];
  metadata?: Record<string, unknown>;
  userName?: string;
  createdAt: string;
  budgetId?: { _id: string; name: string; code?: string } | string;
  procurementId?: { _id: string; purchaseId?: string } | string;
  entityLabel?: string;
};

export function formatBudgetCurrency(amount: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

export async function fetchBudgetConfig(): Promise<BudgetOrgConfig> {
  const res = await fetch(api('/api/budgets/config'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load budget config');
  return data.config;
}

export async function updateBudgetConfig(payload: Partial<BudgetOrgConfig>): Promise<BudgetOrgConfig> {
  const res = await fetch(api('/api/budgets/config'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to save budget config');
  return data.config;
}

export async function fetchBudgetSummary(): Promise<BudgetSummary> {
  const res = await fetch(api('/api/budgets/summary'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load summary');
  return data.summary;
}

export async function fetchBudgets(params: Record<string, string> = {}): Promise<Budget[]> {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(api(`/api/budgets${q ? `?${q}` : ''}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load budgets');
  return data.budgets || [];
}

export async function fetchBudget(id: string): Promise<Budget> {
  const res = await fetch(api(`/api/budgets/${id}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load budget');
  return data.budget;
}

export async function fetchBudgetHistory(id: string): Promise<BudgetHistoryEntry[]> {
  const res = await fetch(api(`/api/budgets/${id}/history`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load history');
  return data.history || [];
}

export async function fetchOrganizationBudgetHistory(
  params: Record<string, string> = {}
): Promise<BudgetHistoryEntry[]> {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(api(`/api/budgets/history${q ? `?${q}` : ''}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load history');
  return data.history || [];
}

export async function createBudget(payload: Partial<Budget>): Promise<Budget> {
  const res = await fetch(api('/api/budgets'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create budget');
  return data.budget;
}

export async function updateBudget(id: string, payload: Partial<Budget>): Promise<Budget> {
  const res = await fetch(api(`/api/budgets/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update budget');
  return data.budget;
}

export async function deleteBudget(id: string): Promise<void> {
  const res = await fetch(api(`/api/budgets/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete budget');
}
