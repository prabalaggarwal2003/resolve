'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NotificationsLink } from './NotificationsLink';

type User = { role?: string };

const navItem = (href: string, icon: string, label: string, active: boolean) => (
  <Link
    key={href}
    href={href}
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

export default function DashboardNav() {
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

  const is = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <nav className="flex flex-col gap-0.5">

      {/* Core */}
      <p className="px-3 pt-1 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-widest">Core</p>
      {navItem('/dashboard', '🏠', 'Dashboard', is('/dashboard'))}
      {navItem('/dashboard/assets', '📦', 'Assets', is('/dashboard/assets'))}
      {navItem('/dashboard/issues', '🔔', 'Issues', is('/dashboard/issues'))}
      {canViewNotifications && <NotificationsLink />}

      {/* Manage */}
      <p className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-widest">Manage</p>
      {canViewLocations && navItem('/dashboard/locations', '📍', 'Locations', is('/dashboard/locations'))}
      {canViewMaintenance && navItem('/dashboard/maintenance', '🔧', 'Maintenance', is('/dashboard/maintenance'))}
      {canViewAssetHealth && navItem('/dashboard/asset-health', '❤️', 'Asset Health', is('/dashboard/asset-health'))}
      {canViewReports && navItem('/dashboard/reports', '📄', 'Reports', is('/dashboard/reports'))}

      {/* Analytics */}
      {(canViewKPIs || canViewDepreciation) && (
        <>
          <p className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-widest">Analytics</p>
          {canViewKPIs && navItem('/dashboard/kpis', '📊', 'KPIs & Metrics', is('/dashboard/kpis'))}
          {canViewDepreciation && navItem('/dashboard/depreciation', '💰', 'Depreciation', is('/dashboard/depreciation'))}
        </>
      )}

      {/* Admin */}
      {(canViewRoles || canViewVendors || canViewAudit || role === 'super_admin') && (
        <>
          <p className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-widest">Admin</p>
          {canViewRoles && navItem('/dashboard/roles', '👥', 'Users & Roles', is('/dashboard/roles'))}
          {canViewVendors && navItem('/dashboard/vendors', '🏢', 'Vendors', is('/dashboard/vendors'))}
          {canViewAudit && navItem('/dashboard/audit', '📋', 'Audit Logs', is('/dashboard/audit'))}
          {role === 'super_admin' && navItem('/dashboard/organization', '⚙️', 'Organization', is('/dashboard/organization'))}
        </>
      )}
    </nav>
  );
}
