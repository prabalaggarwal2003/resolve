'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useNotifications } from '@/contexts/NotificationContext';

type Notification = {
  _id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
  metadata?: {
    assetId?: string;
    assetName?: string;
    ticketId?: string;
    warrantyExpiry?: string;
    daysRemaining?: number;
  };
};

type GroupedNotifications = {
  today: Notification[];
  yesterday: Notification[];
  thisWeek: Notification[];
  older: Notification[];
};

// Notification type icons and colors
const NOTIFICATION_ICONS: Record<string, string> = {
  'issue_created': '🔴',
  'issue_updated': '🔄',
  'issue_resolved': '✅',
  'asset_assigned': '🏷️',
  'warranty_expiry': '❌',
  'warranty_expiring_soon': '⚠️',
  'system': '🔔',
  'default': '📢'
};

const NOTIFICATION_COLORS: Record<string, string> = {
  'issue_created': 'bg-red-50 border-red-200',
  'issue_updated': 'bg-blue-50 border-blue-200',
  'issue_resolved': 'bg-green-50 border-green-200',
  'asset_assigned': 'bg-blue-50 border-blue-200',
  'warranty_expiry': 'bg-red-50 border-red-200',
  'warranty_expiring_soon': 'bg-amber-50 border-amber-200',
  'system': 'bg-gray-50 border-gray-200',
  'default': 'bg-gray-50 border-gray-200'
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function groupNotificationsByTime(notifications: Notification[]): GroupedNotifications {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  return notifications.reduce(
    (groups: GroupedNotifications, notification) => {
      const notifDate = new Date(notification.createdAt);
      const notifDay = new Date(notifDate.getFullYear(), notifDate.getMonth(), notifDate.getDate());

      if (notifDay.getTime() === today.getTime()) {
        groups.today.push(notification);
      } else if (notifDay.getTime() === yesterday.getTime()) {
        groups.yesterday.push(notification);
      } else if (notifDay.getTime() >= weekAgo.getTime()) {
        groups.thisWeek.push(notification);
      } else {
        groups.older.push(notification);
      }

      return groups;
    },
    { today: [], yesterday: [], thisWeek: [], older: [] }
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function NotificationCard({ notification, onMarkRead }: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS['default'];
  const colorClass = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS['default'];

  return (
    <div className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
      notification.read 
        ? 'bg-gray-50 border-gray-200 opacity-75' 
        : `${colorClass} shadow-sm`
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-lg">
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className={`font-semibold text-sm ${
                notification.read ? 'text-gray-600' : 'text-gray-900'
              }`}>
                {notification.title}
              </h3>
              {notification.body && (
                <p className={`text-sm mt-1 leading-relaxed ${
                  notification.read ? 'text-gray-500' : 'text-gray-700'
                }`}>
                  {notification.body}
                </p>
              )}
            </div>

            {/* Unread indicator */}
            {!notification.read && (
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              {formatTime(notification.createdAt)}
            </span>

            <div className="flex items-center gap-2">
              {/* Action button */}
              {notification.link && (
                <Link
                  href={notification.link}
                  className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors font-medium"
                >
                  View Details
                </Link>
              )}

              {/* Mark as read */}
              {!notification.read && (
                <button
                  onClick={() => onMarkRead(notification._id)}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationGroup({ title, notifications, onMarkRead }: {
  title: string;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        {title}
        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
          {notifications.length}
        </span>
      </h2>
      <div className="space-y-3">
        {notifications.map((notification) => (
          <NotificationCard
            key={notification._id}
            notification={notification}
            onMarkRead={onMarkRead}
          />
        ))}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { decrementUnreadCount, setUnreadCountToZero } = useNotifications();

  const fetchNotifications = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(api('/api/notifications'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.notifications) {
        setNotifications(data.notifications);
      } else {
        setError(data.message || 'Failed to load notifications');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      const res = await fetch(api(`/api/notifications/${id}/read`), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => n._id === id ? { ...n, read: true } : n)
        );
        decrementUnreadCount();
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      const res = await fetch(api('/api/notifications/read-all'), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCountToZero();
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Loading notifications...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-500 text-2xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to load notifications</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchNotifications}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const groupedNotifications = groupNotificationsByTime(notifications);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-2">
            Stay updated with your assets, issues, and warranty alerts
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm"
          >
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              📊
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              🔔
            </div>
            <div>
              <p className="text-sm text-blue-600">Unread</p>
              <p className="text-2xl font-bold text-blue-900">{unreadCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-6 rounded-xl border border-green-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              ✅
            </div>
            <div>
              <p className="text-sm text-green-600">Read</p>
              <p className="text-2xl font-bold text-green-900">{notifications.length - unreadCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
            🔔
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">No notifications yet</h3>
          <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
            You'll receive notifications here about asset assignments, issue updates, warranty expiries, and other important updates.
          </p>
        </div>
      ) : (
        /* Notification Groups */
        <div>
          <NotificationGroup
            title="Today"
            notifications={groupedNotifications.today}
            onMarkRead={markAsRead}
          />
          <NotificationGroup
            title="Yesterday"
            notifications={groupedNotifications.yesterday}
            onMarkRead={markAsRead}
          />
          <NotificationGroup
            title="This Week"
            notifications={groupedNotifications.thisWeek}
            onMarkRead={markAsRead}
          />
          <NotificationGroup
            title="Older"
            notifications={groupedNotifications.older}
            onMarkRead={markAsRead}
          />
        </div>
      )}
    </div>
  );
}
