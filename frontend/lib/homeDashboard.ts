import type { HomeDashboard, HomeWidgetFilters } from './homeDashboardWidgets';

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

export function filtersToQuery(filters: HomeWidgetFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, v);
  });
  const q = params.toString();
  return q ? `?${q}` : '';
}

export type HomeDashboardDataResponse = import('./homeDashboardWidgets').HomeDataContext;

export async function fetchHomeDashboardData(pageFilters: HomeWidgetFilters = {}): Promise<HomeDashboardDataResponse> {
  const res = await fetch(api(`/api/home-dashboard/data${filtersToQuery(pageFilters)}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load home dashboard data');
  return data;
}

export async function fetchHomeDashboards(): Promise<HomeDashboard[]> {
  const res = await fetch(api('/api/home-dashboard/dashboards'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load dashboards');
  return data.dashboards || [];
}

export async function fetchHomeDashboard(id: string): Promise<HomeDashboard> {
  const res = await fetch(api(`/api/home-dashboard/dashboards/${id}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load dashboard');
  return data.dashboard;
}

export async function createHomeDashboard(payload: Partial<HomeDashboard>): Promise<HomeDashboard> {
  const res = await fetch(api('/api/home-dashboard/dashboards'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create dashboard');
  return data.dashboard;
}

export async function updateHomeDashboard(id: string, payload: Partial<HomeDashboard>): Promise<HomeDashboard> {
  const res = await fetch(api(`/api/home-dashboard/dashboards/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update dashboard');
  return data.dashboard;
}

export async function duplicateHomeDashboard(id: string, name?: string): Promise<HomeDashboard> {
  const res = await fetch(api(`/api/home-dashboard/dashboards/${id}/duplicate`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to duplicate dashboard');
  return data.dashboard;
}

export async function deleteHomeDashboard(id: string): Promise<void> {
  const res = await fetch(api(`/api/home-dashboard/dashboards/${id}`), { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to delete dashboard');
  }
}

export async function fetchActiveHomeDashboardId(): Promise<string | null> {
  const res = await fetch(api('/api/users/me/preferences/home-dashboard'), { headers: authHeaders() });
  const data = await res.json();
  return data.activeDashboardId || null;
}

export async function saveActiveHomeDashboardId(id: string | null): Promise<void> {
  await fetch(api('/api/users/me/preferences/home-dashboard'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ activeDashboardId: id }),
  });
}

export const AUTO_REFRESH_OPTIONS = [
  { id: 'manual', label: 'Manual', ms: 0 },
  { id: '1m', label: 'Every 1 minute', ms: 60_000 },
  { id: '5m', label: 'Every 5 minutes', ms: 300_000 },
  { id: '15m', label: 'Every 15 minutes', ms: 900_000 },
] as const;
