/**
 * Subscription tier checks and limits
 */

export const TIER_LIMITS = {
  free: { assets: 50, users: 5, showKPIs: false, showDepreciation: false },
  pro: { assets: 200, users: 10, showKPIs: true, showDepreciation: true },
  premium: { assets: 1000, users: 20, showKPIs: true, showDepreciation: true },
};

/** @ts-ignore - Exported for future use */
export function canAccessFeature(tier: string, feature: 'kpis' | 'depreciation'): boolean {
  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;
  if (feature === 'kpis') return limits.showKPIs;
  if (feature === 'depreciation') return limits.showDepreciation;
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


