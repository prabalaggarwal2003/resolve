import type { BudgetWidgetFilters } from './budgetWidgets';

export type BudgetModuleFilters = BudgetWidgetFilters & {
  search?: string;
  budgetId?: string;
  vendorId?: string;
  project?: string;
  costCenter?: string;
  category?: string;
  lifecycleStage?: string;
  paymentStatus?: string;
  groupId?: string;
};

export const BUDGET_MODULE_FILTER_FIELDS: { key: keyof BudgetModuleFilters; label: string }[] = [
  { key: 'financialYear', label: 'Financial year' },
  { key: 'status', label: 'Status' },
  { key: 'budgetTypeId', label: 'Budget type' },
  { key: 'budgetId', label: 'Budget' },
  { key: 'departmentId', label: 'Department' },
  { key: 'locationId', label: 'Location' },
  { key: 'fundingSourceId', label: 'Funding source' },
  { key: 'budgetOwnerId', label: 'Budget owner' },
  { key: 'vendorId', label: 'Vendor' },
  { key: 'project', label: 'Project' },
  { key: 'costCenter', label: 'Cost center' },
  { key: 'category', label: 'Category' },
  { key: 'lifecycleStage', label: 'Lifecycle stage' },
  { key: 'paymentStatus', label: 'Payment status' },
  { key: 'dateFrom', label: 'Date from' },
  { key: 'dateTo', label: 'Date to' },
];

const STORAGE_KEY = 'budget-module-filters';

export function emptyBudgetModuleFilters(): BudgetModuleFilters {
  return {};
}

export function loadBudgetModuleFiltersFromStorage(): BudgetModuleFilters {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveBudgetModuleFiltersToStorage(filters: BudgetModuleFilters) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}

export function budgetModuleFiltersToQuery(filters: BudgetModuleFilters): Record<string, string> {
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (k === 'search') continue;
    if (v != null && v !== '') q[k] = String(v);
  }
  return q;
}

export function timeRangeToDateRange(timeRange?: string): { dateFrom?: string; dateTo?: string } {
  if (!timeRange || timeRange === 'all') return {};
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now);
  if (timeRange === '30d') from.setDate(from.getDate() - 30);
  else if (timeRange === '90d') from.setDate(from.getDate() - 90);
  else if (timeRange === '1y') from.setFullYear(from.getFullYear() - 1);
  else return {};
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: to };
}

export function mergeWidgetTimeRange(
  filters: BudgetWidgetFilters,
  timeRange?: string
): BudgetWidgetFilters {
  if (!timeRange) return filters;
  const range = timeRangeToDateRange(timeRange);
  return {
    ...filters,
    dateFrom: filters.dateFrom || range.dateFrom,
    dateTo: filters.dateTo || range.dateTo,
  };
}

export function isDateInRange(dateStr: string | undefined, filters: BudgetWidgetFilters): boolean {
  if (!dateStr) return !filters.dateFrom && !filters.dateTo;
  const d = new Date(dateStr);
  if (filters.dateFrom && d < new Date(filters.dateFrom)) return false;
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }
  return true;
}

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

export async function fetchBudgetModuleFiltersPreference(): Promise<BudgetModuleFilters> {
  try {
    const res = await fetch(api('/api/users/me/preferences/budget-module-filters'), { headers: authHeaders() });
    const data = await res.json();
    if (res.ok && data.filters) return data.filters;
  } catch {
    /* ignore */
  }
  return loadBudgetModuleFiltersFromStorage();
}

export async function saveBudgetModuleFiltersPreference(filters: BudgetModuleFilters): Promise<void> {
  saveBudgetModuleFiltersToStorage(filters);
  try {
    await fetch(api('/api/users/me/preferences/budget-module-filters'), {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ filters }),
    });
  } catch {
    /* ignore */
  }
}
