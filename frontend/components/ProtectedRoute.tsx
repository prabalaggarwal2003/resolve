'use client';

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  redirectTo = '/login' 
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Check if user was logged out
    const wasLoggedOut = localStorage.getItem('loggedOut') === 'true';

    if (requireAuth && (!isAuthenticated || wasLoggedOut)) {
      // Clear the loggedOut flag
      localStorage.removeItem('loggedOut');
      router.push(redirectTo);

      // Prevent back navigation by clearing history
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', (event) => {
          event.preventDefault();
          router.push(redirectTo);
        });
      }
    }
  }, [isAuthenticated, requireAuth, redirectTo, router]);

  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
