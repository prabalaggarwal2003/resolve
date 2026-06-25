'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NotificationsLink } from './NotificationsLink';

type User = { role?: string };

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

export default function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (raw) setUser(JSON.parse(raw));
    } catch (_) {}
  }, []);

  const role = user?.role ?? '';
  const canViewRoles = ['super_admin', 'admin'].includes(role);
  const canViewAudit = ['super_admin', 'admin'].includes(role);
  const canViewAssetHealth = role === 'super_admin';
  const canViewMaintenance = ['super_admin', 'admin', 'manager'].includes(role);
  const canViewDepreciation = ['super_admin', 'admin'].includes(role);
  const canViewKPIs = ['super_admin', 'admin'].includes(role);
  const canViewVendors = role === 'super_admin';
  const canViewNotifications = role === 'super_admin';
  const canViewLocations = role === 'super_admin';
  const canViewReports = ['super_admin', 'manager'].includes(role);
  const canViewSubscriptions = ['super_admin', 'admin'].includes(role);

  const is = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <nav className="flex flex-col gap-0.5">

      {/* Core */}
      <p className="px-3 pt-1 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-widest">Core</p>
      {navItem('/dashboard', '🏠', 'Dashboard', is('/dashboard'), onNavigate)}
      {navItem('/dashboard/assets', '📦', 'Assets', is('/dashboard/assets'), onNavigate)}
      {navItem('/dashboard/issues', '🔔', 'Issues', is('/dashboard/issues'), onNavigate)}
      {/*{canViewNotifications && <NotificationsLink />}*/}

      {/* Manage */}
      <p className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-widest">Manage</p>
      {canViewLocations && navItem('/dashboard/locations', '📍', 'Locations', is('/dashboard/locations'), onNavigate)}
      {canViewMaintenance && navItem('/dashboard/maintenance', '🔧', 'Maintenance', is('/dashboard/maintenance'), onNavigate)}
      {/*{canViewAssetHealth && navItem('/dashboard/asset-health', '❤️', 'Asset Health', is('/dashboard/asset-health'), onNavigate)}*/}
      {canViewReports && navItem('/dashboard/reports', '📄', 'Reports', is('/dashboard/reports'), onNavigate)}

      {/* Analytics */}
      {(canViewKPIs || canViewDepreciation) && (
        <>
          <p className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-widest">Analytics</p>
          {canViewKPIs && navItem('/dashboard/kpis', '📊', 'KPIs & Metrics', is('/dashboard/kpis'), onNavigate)}
          {canViewDepreciation && navItem('/dashboard/depreciation', '💰', 'Depreciation', is('/dashboard/depreciation'), onNavigate)}
        </>
      )}

      {/* Admin */}
      {(canViewRoles || canViewVendors || canViewAudit || role === 'super_admin') && (
        <>
          <p className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-widest">Admin</p>
          {canViewRoles && navItem('/dashboard/roles', '👥', 'Users & Roles', is('/dashboard/roles'), onNavigate)}
          {canViewVendors && navItem('/dashboard/vendors', '🏢', 'Vendors', is('/dashboard/vendors'), onNavigate)}
          {canViewAudit && navItem('/dashboard/audit', '📋', 'Audit Logs', is('/dashboard/audit'), onNavigate)}
          {role === 'super_admin' && navItem('/dashboard/organization', '⚙️', 'Organization', is('/dashboard/organization'), onNavigate)}
        </>
      )}

      {/* Settings */}
      {canViewSubscriptions && (
        <>
          <p className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-widest">Settings</p>
          {role === 'super_admin' && navItem('/dashboard/profile', '👤', 'Profile', is('/dashboard/profile'), onNavigate)}
          {navItem('/dashboard/subscriptions', '💳', 'Subscriptions', is('/dashboard/subscriptions'), onNavigate)}
        </>
      )}
    </nav>
  );
}
