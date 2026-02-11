'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => void;
  decrementUnreadCount: () => void;
  setUnreadCountToZero: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    fetch(api('/api/notifications'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.unreadCount === 'number') {
          setUnreadCount(d.unreadCount);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const refreshUnreadCount = () => {
    fetchUnreadCount();
  };

  const decrementUnreadCount = () => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const setUnreadCountToZero = () => {
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        decrementUnreadCount,
        setUnreadCountToZero,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

