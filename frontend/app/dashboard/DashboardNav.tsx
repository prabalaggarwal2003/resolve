'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { NotificationsLink } from './NotificationsLink';

type User = { role?: string };

export default function DashboardNav() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (raw) setUser(JSON.parse(raw));
    } catch (_) {}
  }, []);

  const role = user?.role ?? '';
  const canManageUsers = role === 'super_admin' || role === 'admin';
  const canViewRoles = canManageUsers || role === 'principal';
  const canViewAudit = ['super_admin', 'admin', 'manager'].includes(role);
  const canViewAssetHealth = ['super_admin', 'admin', 'manager'].includes(role);
  const canViewMaintenance = ['super_admin', 'admin', 'manager'].includes(role);
  const canViewDepreciation = ['super_admin', 'admin', 'manager', 'principal'].includes(role);
  const canViewKPIs = ['super_admin', 'admin', 'manager', 'principal'].includes(role);
  const canViewVendors = ['super_admin', 'admin', 'manager'].includes(role);
  const reportOnly = ['teacher', 'student', 'reporter'].includes(role);

  return (
    <nav className="mt-8 flex flex-col gap-1">
      <Link href="/dashboard" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
        Dashboard
      </Link>
      <Link href="/dashboard/assets" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
        Assets
      </Link>
      <Link href="/dashboard/issues" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
        Issues
      </Link>
      {!reportOnly && (
        <>
          <Link href="/dashboard/locations" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
            Locations
          </Link>
          <Link href="/dashboard/reports" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
            Reports
          </Link>
        </>
      )}
      {canViewRoles && (
        <Link href="/dashboard/roles" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
          Users & Roles
        </Link>
      )}
      {canViewVendors && (
        <Link href="/dashboard/vendors" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
          🏢 Vendors
        </Link>
      )}
      {canViewKPIs && (
        <Link href="/dashboard/kpis" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
          📊 KPIs & Metrics
        </Link>
      )}
      {canViewDepreciation && (
        <Link href="/dashboard/depreciation" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
          💰 Depreciation
        </Link>
      )}
      {canViewMaintenance && (
        <Link href="/dashboard/maintenance" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
          🔧 Maintenance
        </Link>
      )}
      {canViewAssetHealth && (
        <Link href="/dashboard/asset-health" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
          📈 Asset Health
        </Link>
      )}
      {canViewAudit && (
        <Link href="/dashboard/audit" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
          📊 Audit Logs
        </Link>
      )}
      {role === 'super_admin' && (
        <Link href="/dashboard/organization" className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700">
          Organization
        </Link>
      )}
      <NotificationsLink />
    </nav>
  );
}
