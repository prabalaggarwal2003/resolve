const TIER_LIMITS = {
  free: { assets: 50, users: 5 },
  pro: { assets: 200, users: 10 },
  premium: { assets: 1000, users: 20 },
};

/** Org subscription status — available to all members for feature gating. */
export function getOrganizationSubscriptionStatus(org) {
  if (!org) {
    return {
      tier: 'free',
      plan: 'monthly',
      isExpired: false,
      daysRemaining: null,
      limits: TIER_LIMITS.free,
      canUpgrade: true,
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      razorpaySubscriptionId: null,
    };
  }

  const now = new Date();
  const isExpired = Boolean(org.subscriptionEndDate && org.subscriptionEndDate < now);

  let daysRemaining = null;
  if (org.subscriptionEndDate && !isExpired) {
    const diff = org.subscriptionEndDate.getTime() - now.getTime();
    daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const tier = isExpired ? 'free' : (org.subscriptionTier || 'free');
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  return {
    tier,
    plan: org.subscriptionPlan || 'monthly',
    razorpaySubscriptionId: org.razorpaySubscriptionId || null,
    subscriptionStartDate: org.subscriptionStartDate || null,
    subscriptionEndDate: org.subscriptionEndDate || null,
    isExpired,
    daysRemaining,
    limits,
    canUpgrade: tier !== 'premium',
  };
}
