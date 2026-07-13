'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  PERMISSION_TABS,
  PROFILE_TAB,
  resolvePermissions,
  canReadTab,
  getStoredUser,
  type PermissionTabKey,
} from '@/lib/permissions';

type User = { role?: string; permissions?: Record<string, 'read' | 'write' | null>; isSuperAdmin?: boolean };

const navItem = (href: string, icon: string, label: string, active: boolean, onNavigate?: () => void) => (
  <Link
    key={href}
    href={href}
    onClick={() => onNavigate?.()}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all no-underline
      ${active
        ? 'bg-gray-100/10 text-gray-100 border border-gray-700/60'
        : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'
      }`}
  >
    <span className="text-base leading-none">{icon}</span>
    <span>{label}</span>
  </Link>
);

const TAB_NAV: Record<PermissionTabKey, { href: string; icon: string; label: string; section: string }> = {
  dashboard: { href: '/dashboard', icon: '🏠', label: 'Dashboard', section: 'Core' },
  assets: { href: '/dashboard/assets', icon: '📦', label: 'Assets', section: 'Core' },
  issues: { href: '/dashboard/issues', icon: '🔔', label: 'Issues', section: 'Core' },
  locations: { href: '/dashboard/locations', icon: '📍', label: 'Locations', section: 'Manage' },
  maintenance: { href: '/dashboard/maintenance', icon: '🔧', label: 'Maintenance', section: 'Manage' },
  assetHealth: { href: '/dashboard/asset-health', icon: '💚', label: 'Asset Health', section: 'Analytics' },
  reports: { href: '/dashboard/reports', icon: '📄', label: 'Reports', section: 'Manage' },
  kpis: { href: '/dashboard/kpis', icon: '📊', label: 'KPIs & Metrics', section: 'Analytics' },
  depreciation: { href: '/dashboard/depreciation', icon: '💰', label: 'Depreciation', section: 'Analytics' },
  budgets: { href: '/dashboard/budgets', icon: '📑', label: 'Budgets & Procurement', section: 'Analytics' },
  insights: { href: '/dashboard/insights', icon: '💡', label: 'Insights', section: 'Analytics' },
  roles: { href: '/dashboard/roles', icon: '👥', label: 'Users & Roles', section: 'Admin' },
  vendors: { href: '/dashboard/vendors', icon: '🏢', label: 'Vendors', section: 'Admin' },
  audit: { href: '/dashboard/audit', icon: '📋', label: 'Audit Logs', section: 'Admin' },
  organization: { href: '/dashboard/organization', icon: '⚙️', label: 'Organization', section: 'Admin' },
  subscriptions: { href: '/dashboard/subscriptions', icon: '💳', label: 'Subscriptions', section: 'Settings' },
};

const SECTION_ORDER = ['Core', 'Manage', 'Analytics', 'Admin', 'Settings'];

export default function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());
    syncUser();
    window.addEventListener('user-updated', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('user-updated', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  const permissions = resolvePermissions(user);
  const is = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const visibleBySection = SECTION_ORDER.map((section) => {
    const items = PERMISSION_TABS.filter((tab) => {
      if (tab.section !== section) return false;
      return canReadTab(permissions, tab.key);
    }).map((tab) => TAB_NAV[tab.key]);
    if (section === 'Settings') {
      items.push({
        href: PROFILE_TAB.path,
        icon: '👤',
        label: PROFILE_TAB.label,
        section: 'Settings',
      });
    }
    return { section, items };
  }).filter((group) => group.items.length > 0);

  return (
    <nav className="flex flex-col gap-0.5">
      {visibleBySection.map(({ section, items }) => (
        <div key={section}>
          <p className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-widest first:pt-1">
            {section}
          </p>
          {items.map((item) => navItem(item.href, item.icon, item.label, is(item.href), onNavigate))}
        </div>
      ))}
    </nav>
  );
}
