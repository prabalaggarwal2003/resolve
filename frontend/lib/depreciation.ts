export type YearRate = { year: number; rate: number };

export type DepreciationPolicy = {
  _id: string;
  name: string;
  method: 'SLM' | 'WDV';
  rate: number;
  yearRates?: YearRate[];
  residualPct?: number;
  isOrgDefault?: boolean;
  description?: string;
};

export type PolicyAssignment = {
  _id: string;
  policyId: { _id: string; name: string; method: string; rate: number } | string;
  targetType: 'group' | 'category';
  targetId?: string | null;
  targetKey?: string | null;
};

export type AssetDepreciationMetrics = {
  assetId: string;
  assetIdString: string;
  name: string;
  category: string;
  templateId?: string | null;
  templateName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  location?: string;
  locationId?: string | null;
  department?: string;
  departmentId?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  status?: string;
  purchaseDate?: string;
  purchaseYear?: number | null;
  ageYears: number;
  policy?: {
    id: string;
    name: string;
    method: 'SLM' | 'WDV';
    rate: number;
    yearRates?: YearRate[];
    effectiveRate: number;
    source: string;
    hasOverride?: boolean;
    overrideReason?: string | null;
  } | null;
  financial: {
    purchaseCost: number;
    currentBookValue: number;
    totalDepreciation: number;
    depreciationPercentage: number;
    method?: string;
    depreciationRate?: number;
  };
  slm: { currentBookValue: number; depreciationPercentage: number; purchaseCost: number };
  wdv: { currentBookValue: number; depreciationPercentage: number; purchaseCost: number };
  operational: {
    healthScore: number;
    healthLabel: string;
    replacementPriority: string;
    replacementLabel: string;
    replacementEmoji: string;
    warrantyActive: boolean;
    warrantyExpiringSoon: boolean;
    estimatedRemainingUsefulLife: number;
    issueCount: number;
    openIssueCount: number;
    maintenanceCount: number;
  };
  indicators: {
    fullyDepreciated: boolean;
    nearEndOfLife: boolean;
    replacementRecommended: boolean;
    highValueAsset: boolean;
  };
};

export type DepreciationFilters = {
  method?: string;
  policyId?: string;
  groupId?: string;
  templateId?: string;
  category?: string;
  purchaseYear?: string;
  departmentId?: string;
  locationId?: string;
  vendorId?: string;
  warrantyStatus?: string;
  fullyDepreciated?: string;
  replacementPriority?: string;
  purchaseMin?: string;
  purchaseMax?: string;
  bookMin?: string;
  bookMax?: string;
  depPctMin?: string;
  depPctMax?: string;
  healthMin?: string;
};

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

export function filtersToQuery(filters: DepreciationFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, v);
  });
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const POLICY_SOURCE_LABELS: Record<string, string> = {
  category: 'Category',
  group: 'Asset group',
  org_default: 'Organization default',
  none: '—',
};
