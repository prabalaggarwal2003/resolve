'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UpgradeNudge {
  id: string;
  type: 'banner' | 'popup' | 'inline';
  title: string;
  description: string;
  feature: string;
  cta: string;
  condition?: () => boolean;
  icon?: string;
}

const NUDGES: UpgradeNudge[] = [
  {
    id: 'assets-limit',
    type: 'banner',
    title: 'Asset limit reached',
    description: 'You\'re using 50 assets. Upgrade to Pro (200 assets) or Premium (1000 assets).',
    feature: '4x more assets with Pro',
    cta: 'Upgrade Now',
    icon: '📦',
  },
  {
    id: 'users-limit',
    type: 'banner',
    title: 'User limit approaching',
    description: 'Free plan limited to 5 users. Pro allows 10 users, Premium allows 20.',
    feature: 'Unlimited team management',
    cta: 'See Plans',
    icon: '👥',
  },
  {
    id: 'kpi-locked',
    type: 'inline',
    title: 'KPIs & Metrics Locked',
    description: 'Track asset utilization with detailed KPIs and analytics.',
    feature: 'Available on Pro & Premium',
    cta: 'Unlock KPIs',
    icon: '📊',
  },
  {
    id: 'depreciation-locked',
    type: 'inline',
    title: 'Depreciation Tracking Locked',
    description: 'Calculate asset value depreciation with detailed analytics.',
    feature: 'Available on Pro & Premium',
    cta: 'Unlock Depreciation',
    icon: '💰',
  },

  {
    id: 'kpi-popup',
    type: 'popup',
    title: 'Unlock KPIs & Metrics',
    description: 'Get detailed insights into asset utilization, costs, and performance metrics.',
    feature: 'Available on Pro and Premium plans',
    cta: 'Upgrade Now',
    icon: '📊',
  },
  {
    id: 'collaboration-popup',
    type: 'popup',
    title: 'Expand Your Team',
    description: 'Free plan is limited to 5 users. Pro allows 10 team members, Premium allows 20.',
    feature: 'Collaborate with your entire team',
    cta: 'See All Plans',
    icon: '👥',
  },

  {
    id: 'depreciation-popup',
    type: 'popup',
    title: 'Track Asset Depreciation',
    description: 'Automatically calculate asset depreciation and monitor asset value over time.',
    feature: 'Available on Pro and Premium plans',
    cta: 'Learn More',
    icon: '💰',
  },
  {
    id: 'asset-limit',
    type: 'inline',
    title: 'Only 50 assets allowed',
    description: 'Upgrade to Pro for 200 assets or Premium for 1000 assets.',
    feature: '4x more assets with Pro',
    cta: 'Upgrade Now',
    icon: '📦',
  },
];

interface UpgradeNudgesProps {
  userTier: 'free' | 'pro' | 'premium';
  assetCount?: number;
  userCount?: number;
  dismissedNudges?: string[];
  onDismiss?: (nudgeId: string) => void;
}

export default function UpgradeNudges({
  userTier,
  assetCount = 0,
  userCount = 0,
  dismissedNudges = [],
  onDismiss,
}: UpgradeNudgesProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [popupNudge, setPopupNudge] = useState<UpgradeNudge | null>(null);

  // Always show banners and inline nudges for free tier
  const visibleNudges = userTier === 'free' ? NUDGES.filter((nudge) => nudge.type === 'banner' || nudge.type === 'inline') : [];

  // Separate effect for popup logic - appears every 10 minutes
  useEffect(() => {
    if (userTier !== 'free') return;

    const showRandomPopup = () => {
      const popupNudges = NUDGES.filter(
        (n) => n.type === 'popup' && !dismissedNudges.includes(n.id)
      );
      if (popupNudges.length > 0) {
        const randomPopup = popupNudges[Math.floor(Math.random() * popupNudges.length)];
        setPopupNudge(randomPopup);
        setShowPopup(true);
      }
    };

    // Show first popup after 10 seconds
    const initialTimer = setTimeout(showRandomPopup, 10000);

    // Show popup every 10 minutes (600000ms)
    const intervalId = setInterval(showRandomPopup, 600000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    };
  }, [userTier, dismissedNudges]);

  // Only show nudges for free tier - AFTER all hooks
  if (userTier !== 'free') return null;

  const handleDismissPopup = (nudgeId: string) => {
    setShowPopup(false);
    onDismiss?.(nudgeId);
  };

  const bannerNudges = visibleNudges.filter((n) => n.type === 'banner');
  const inlineNudges = visibleNudges.filter((n) => n.type === 'inline');

  return (
    <>
      {/* Banner Nudges - Always Visible */}
      {bannerNudges.map((nudge) => (
        <div key={nudge.id} className="mb-4 p-4 bg-blue-900/30 border border-blue-700/60 rounded-lg flex items-start justify-between gap-4 animate-slideDown">
          <div className="flex items-start gap-3 flex-1">
            <span className="text-2xl">{nudge.icon}</span>
            <div>
              <p className="font-semibold text-blue-300">{nudge.title}</p>
              <p className="text-sm text-blue-400 mt-1">{nudge.description}</p>
              <p className="text-xs text-blue-500 font-medium mt-2">✨ {nudge.feature}</p>
            </div>
          </div>
          <Link
            href="/dashboard/subscriptions"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors no-underline shrink-0"
          >
            {nudge.cta}
          </Link>
        </div>
      ))}

      {/* Inline Nudges - Always Visible Grid */}
      {inlineNudges.length > 0 && (
        <div className="mt-8 mb-8">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Upgrade to unlock more features</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {inlineNudges.map((nudge) => (
              <div
                key={nudge.id}
                className="p-4 bg-gray-800/50 border border-gray-700/60 rounded-lg hover:border-gray-600/80 transition-all group"
              >
                <div className="mb-3">
                  <span className="text-2xl">{nudge.icon}</span>
                </div>
                <p className="font-semibold text-gray-100 text-sm mb-2">{nudge.title}</p>
                <p className="text-xs text-gray-400 mb-3">{nudge.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-400">{nudge.feature}</span>
                  <Link
                    href="/dashboard/subscriptions"
                    className="text-xs px-3 py-1 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/40 transition-colors no-underline font-medium"
                  >
                    {nudge.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popup Nudge - Only this can be dismissed */}
      {showPopup && popupNudge && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 max-w-md shadow-2xl pointer-events-auto animate-slideUp">
            <div className="flex items-start justify-between mb-4">
              <span className="text-4xl">{popupNudge.icon}</span>
              <button
                onClick={() => handleDismissPopup(popupNudge.id)}
                className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <h3 className="text-xl font-bold text-gray-100 mb-2">{popupNudge.title}</h3>
            <p className="text-sm text-gray-400 mb-4">{popupNudge.description}</p>
            <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-3 mb-4">
              <p className="text-sm font-semibold text-blue-300">✨ {popupNudge.feature}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDismissPopup(popupNudge.id)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 pointer-events-auto"
            onClick={() => handleDismissPopup(popupNudge.id)}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
    </>
  );
}


