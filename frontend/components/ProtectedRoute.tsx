'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';

function isSessionValid() {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem('loggedOut') === 'true') return false;
  return Boolean(localStorage.getItem('token'));
}

function redirectToLogin() {
  localStorage.removeItem('loggedOut');
  window.location.replace('/login');
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const enforceAuth = () => {
      if (!isSessionValid()) {
        redirectToLogin();
        return false;
      }
      return true;
    };

    if (enforceAuth()) {
      setHydrated(true);
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted || !isSessionValid()) {
        if (!enforceAuth()) setHydrated(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !enforceAuth()) {
        setHydrated(false);
      }
    };

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isSessionValid()) {
      setHydrated(false);
      redirectToLogin();
      return;
    }
    if (isAuthenticated) {
      setHydrated(true);
    }
  }, [isAuthenticated]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <LoadingSpinner message="Redirecting to login..." />
      </div>
    );
  }

  return <>{children}</>;
}
