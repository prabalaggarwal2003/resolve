'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Notification = {
  _id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    fetch(api('/api/notifications'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.notifications) setNotifications(d.notifications);
        else setError(d.message || 'Failed to load');
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (id: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    await fetch(api(`/api/notifications/${id}/read`), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchNotifications();
  };

  const markAllRead = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    await fetch(api('/api/notifications/read-all'), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Notifications</h1>
      <p className="text-slate-600 mb-6">
        Report submitted / updated / resolved; maintenance due
      </p>

      {unreadCount > 0 && (
        <button
          type="button"
          onClick={markAllRead}
          className="mb-4 px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
        >
          Mark all as read
        </button>
      )}

      {loading && <p className="text-slate-600">Loading…</p>}
      {error && <p className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>}

      {!loading && !error && notifications.length === 0 && (
        <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-slate-600">
          No notifications yet.
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n._id}
              className={`bg-white rounded-lg border p-4 ${n.read ? 'border-slate-200 opacity-75' : 'border-primary/30 bg-primary/5'}`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-slate-600 mt-1">{n.body}</p>}
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                  {n.link && (
                    <Link href={n.link} className="text-primary text-sm hover:underline mt-2 inline-block">
                      View →
                    </Link>
                  )}
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markRead(n._id)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 shrink-0"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
