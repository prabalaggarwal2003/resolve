/**
 * Subscription tier checks and limits
 */

export type OrgSubscription = {
  tier: string;
  isExpired: boolean;
  plan?: string;
};

export const TIER_LIMITS = {
  free: { assets: 50, users: 5, showKPIs: false, showDepreciation: false, showVendors: false, showDataExports: false },
  pro: { assets: 200, users: 10, showKPIs: true, showDepreciation: true, showVendors: true, showDataExports: true },
  premium: { assets: 1000, users: 20, showKPIs: true, showDepreciation: true, showVendors: true, showDataExports: true },
};

/** @ts-ignore - Exported for future use */
export function canAccessFeature(tier: string, feature: 'kpis' | 'depreciation' | 'vendors' | 'dataExports'): boolean {
  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;
  if (feature === 'kpis') return limits.showKPIs;
  if (feature === 'depreciation') return limits.showDepreciation;
  if (feature === 'vendors') return limits.showVendors;
  if (feature === 'dataExports') return limits.showDataExports;
  return false;
}

/** @ts-ignore - Exported for future use */
export function getAssetLimit(tier: string): number {
  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;
  return limits.assets;
}

/** @ts-ignore - Exported for future use */
export function getUserLimit(tier: string): number {
  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;
  return limits.users;
}

/** Read org subscription cached on the logged-in user (login / session refresh). */
export function getStoredSubscription(): OrgSubscription {
  if (typeof window === 'undefined') return { tier: 'free', isExpired: false };
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const sub = user?.subscription;
    if (sub?.tier) {
      return {
        tier: sub.tier,
        isExpired: Boolean(sub.isExpired),
        plan: sub.plan,
      };
    }
  } catch {
    /* ignore */
  }
  return { tier: 'free', isExpired: false };
}

/** Fetch org subscription for feature gating — all org members, not subscriptions-tab only. */
export async function fetchOrgSubscription(
  api: (path: string) => string
): Promise<OrgSubscription> {
  const fallback = getStoredSubscription();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return fallback;

  try {
    const res = await fetch(api('/api/payments/subscription-status'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      return {
        tier: data.tier || 'free',
        isExpired: Boolean(data.isExpired),
        plan: data.plan,
      };
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function UpgradePrompt({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border-2 border-dashed border-gray-700 bg-gray-900/40">
      <div className="text-4xl mb-3">🔐</div>
      <h3 className="text-lg font-semibold text-gray-100 mb-2">Premium Feature</h3>
      <p className="text-gray-400 text-center mb-4">
        {feature} is available on Pro and Premium plans
      </p>
      <a
        href="/dashboard/subscriptions"
        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Upgrade Now
      </a>
    </div>
  );
}


