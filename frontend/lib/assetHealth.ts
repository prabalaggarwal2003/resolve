import type { HealthWidgetFilters } from './assetHealthWidgets';

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

export function filtersToQuery(filters: HealthWidgetFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, v);
  });
  const q = params.toString();
  return q ? `?${q}` : '';
}

export type HealthAssetRow = {
  assetId: string;
  assetIdString: string;
  name: string;
  category: string;
  status: string;
  condition: string;
  groupId?: string | null;
  groupName?: string | null;
  departmentId?: string | null;
  department?: string | null;
  locationId?: string | null;
  location?: string | null;
  healthScore: number;
  healthLabel: string;
  healthLevel: string;
  healthEmoji?: string;
};

export type HealthTotals = {
  totalAssets: number;
  avgHealthScore: number;
  distribution: Record<string, number>;
};

export type HealthTrendPoint = {
  date: string;
  avgScore: number;
  distribution: Record<string, number>;
  assetCount?: number;
};

export type HealthSummaryResponse = {
  totals: HealthTotals;
  assets: HealthAssetRow[];
  lowestHealthAssets: HealthAssetRow[];
  trend: HealthTrendPoint[];
  healthLevels: Array<{ min: number; max: number; label: string; key: string; emoji: string }>;
};

export type HealthFactorSource =
  | 'ageYears' | 'openIssueCount' | 'issueCount' | 'maintenanceCount' | 'daysSinceLastAudit';

export type HealthFactorDef = {
  enabled: boolean;
  weight: number;
  custom?: boolean;
  label?: string;
  source?: HealthFactorSource;
};

export type HealthFactorConfig = Record<string, HealthFactorDef>;

export const BUILTIN_FACTOR_KEYS = [
  'age', 'condition', 'issues', 'maintenance', 'warranty', 'audit', 'downtime',
] as const;

export const BUILTIN_FACTOR_LABELS: Record<string, string> = {
  age: 'Age',
  condition: 'Condition',
  issues: 'Open Issues',
  maintenance: 'Maintenance History',
  warranty: 'Warranty',
  audit: 'Audit Status',
  downtime: 'Downtime',
};

export const CUSTOM_FACTOR_SOURCES: { key: HealthFactorSource; label: string; unit: string }[] = [
  { key: 'ageYears', label: 'Asset age (years)', unit: 'years' },
  { key: 'openIssueCount', label: 'Open issues', unit: 'issues' },
  { key: 'issueCount', label: 'Total issues', unit: 'issues' },
  { key: 'maintenanceCount', label: 'Maintenance events', unit: 'events' },
  { key: 'daysSinceLastAudit', label: 'Days since last audit', unit: 'days' },
];

export const DEFAULT_CUSTOM_FACTOR_BANDS = [
  { min: 0, max: 2, score: 100 },
  { min: 2, max: 5, score: 70 },
  { min: 5, max: null, score: 40 },
];

export function isCustomFactor(def?: HealthFactorDef): boolean {
  return !!def && def.custom === true;
}

export function factorLabel(key: string, factors: HealthFactorConfig): string {
  const def = factors[key];
  if (isCustomFactor(def) && def.label) return def.label;
  return BUILTIN_FACTOR_LABELS[key] || key;
}

export function getAllFactorKeys(factors: HealthFactorConfig): string[] {
  const keys: string[] = [...BUILTIN_FACTOR_KEYS];
  for (const key of Object.keys(factors || {})) {
    if (!keys.includes(key) && isCustomFactor(factors[key])) keys.push(key);
  }
  return keys;
}

export type HealthOrgConfig = {
  _id?: string;
  factors: HealthFactorConfig;
  thresholds: Record<string, unknown>;
  healthLevels: Array<{ min: number; max: number; label: string; key: string; emoji: string }>;
  automationRules: Array<Record<string, unknown>>;
  autoUpdateCondition: boolean;
  defaultNewAssetCondition: 'excellent' | 'good';
};

export type HealthProfile = {
  _id: string;
  name: string;
  description?: string;
  groupId?: string | null;
  enabled: boolean;
  factors: HealthFactorConfig;
  thresholds: Record<string, unknown>;
};

export type HealthDashboard = {
  _id: string;
  name: string;
  description?: string;
  scope: 'personal' | 'organization';
  templateId?: string | null;
  layout: import('./assetHealthWidgets').HealthDashboardLayout;
  autoRefresh?: string;
};

export async function fetchHealthData(filters: HealthWidgetFilters = {}): Promise<HealthSummaryResponse> {
  const res = await fetch(api(`/api/asset-health/data${filtersToQuery(filters)}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load health data');
  return data;
}

export async function fetchHealthConfig(): Promise<HealthOrgConfig> {
  const res = await fetch(api('/api/asset-health/config'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load config');
  return data.config;
}

export async function updateHealthConfig(payload: Partial<HealthOrgConfig>): Promise<HealthOrgConfig> {
  const res = await fetch(api('/api/asset-health/config'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to save config');
  return data.config;
}

export async function previewHealthScore(payload: Record<string, unknown>) {
  const res = await fetch(api('/api/asset-health/config/preview'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Preview failed');
  return data.preview;
}

export async function fetchHealthProfiles(): Promise<HealthProfile[]> {
  const res = await fetch(api('/api/asset-health/profiles'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load profiles');
  return data.profiles || [];
}

export async function createHealthProfile(payload: Partial<HealthProfile>): Promise<HealthProfile> {
  const res = await fetch(api('/api/asset-health/profiles'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create profile');
  return data.profile;
}

export async function updateHealthProfile(id: string, payload: Partial<HealthProfile>): Promise<HealthProfile> {
  const res = await fetch(api(`/api/asset-health/profiles/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update profile');
  return data.profile;
}

export async function deleteHealthProfile(id: string): Promise<void> {
  const res = await fetch(api(`/api/asset-health/profiles/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to delete profile');
  }
}

export async function fetchHealthDashboards(): Promise<HealthDashboard[]> {
  const res = await fetch(api('/api/asset-health/dashboards'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load dashboards');
  return data.dashboards || [];
}

export async function createHealthDashboard(payload: Partial<HealthDashboard>): Promise<HealthDashboard> {
  const res = await fetch(api('/api/asset-health/dashboards'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create dashboard');
  return data.dashboard;
}

export async function updateHealthDashboard(id: string, payload: Partial<HealthDashboard>): Promise<HealthDashboard> {
  const res = await fetch(api(`/api/asset-health/dashboards/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update dashboard');
  return data.dashboard;
}

export async function deleteHealthDashboard(id: string): Promise<void> {
  const res = await fetch(api(`/api/asset-health/dashboards/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to delete dashboard');
  }
}

export const AUTO_REFRESH_OPTIONS = [
  { id: 'manual', label: 'Manual', ms: 0 },
  { id: '1m', label: '1 min', ms: 60_000 },
  { id: '5m', label: '5 min', ms: 300_000 },
  { id: '15m', label: '15 min', ms: 900_000 },
];

const ACTIVE_DASHBOARD_KEY = 'assetHealthActiveDashboardId';

export function fetchActiveHealthDashboardId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_DASHBOARD_KEY);
}

export function saveActiveHealthDashboardId(id: string) {
  if (typeof window !== 'undefined') localStorage.setItem(ACTIVE_DASHBOARD_KEY, id);
}

export async function runHealthCheckAll() {
  const res = await fetch(api('/api/asset-health/check-all'), { method: 'POST', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Health check failed');
  return data;
}
