'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotifications } from '@/contexts/NotificationContext';

export function NotificationsLink() {
  const { unreadCount } = useNotifications();
  const pathname = usePathname();
  const active = pathname.startsWith('/dashboard/notifications');

  return (
    <Link
      href="/dashboard/notifications"
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all no-underline
        ${active
          ? 'bg-gray-100/10 text-gray-100 border border-gray-700/60'
          : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'
        }`}
    >
      <span className="text-base leading-none">🔕</span>
      <span>Notifications</span>
      {unreadCount > 0 && (
        <span className="ml-auto px-1.5 py-0.5 text-xs font-bold rounded-full bg-gray-300 text-gray-950">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
