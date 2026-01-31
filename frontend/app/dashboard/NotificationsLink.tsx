'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export function NotificationsLink() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    fetch(api('/api/notifications'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => typeof d.unreadCount === 'number' && setUnreadCount(d.unreadCount))
      .catch(() => {});
  }, []);

  return (
    <Link
      href="/dashboard/notifications"
      className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 flex items-center gap-2"
    >
      Notifications
      {unreadCount > 0 && (
        <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
