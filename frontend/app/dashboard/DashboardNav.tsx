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
  const reportOnly = ['teacher', 'student', 'reporter'].includes(role);

  return (
    <nav className="mt-8 flex flex-col gap-1">
      <Link href="/dashboard" className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100">
        Dashboard
      </Link>
      <Link href="/dashboard/assets" className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100">
        Assets
      </Link>
      <Link href="/dashboard/issues" className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100">
        Issues
      </Link>
      {!reportOnly && (
        <>
          <Link href="/dashboard/locations" className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100">
            Locations
          </Link>
          <Link href="/dashboard/reports" className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100">
            Reports
          </Link>
        </>
      )}
      {canViewRoles && (
        <Link href="/dashboard/roles" className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100">
          Users & Roles
        </Link>
      )}
      <NotificationsLink />
    </nav>
  );
}
