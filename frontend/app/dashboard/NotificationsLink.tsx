'use client';

import Link from 'next/link';
import { useNotifications } from '@/contexts/NotificationContext';

export function NotificationsLink() {
  const { unreadCount } = useNotifications();

  return (
    <Link
      href="/dashboard/notifications"
      className="px-3 py-2 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2"
    >
      Notifications
      {unreadCount > 0 && (
        <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary dark:bg-blue-500 text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
