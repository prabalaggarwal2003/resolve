'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DashboardNav from './DashboardNav';
import { NotificationProvider } from '@/contexts/NotificationContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { refreshStoredUser } from '@/lib/permissions';
import { apiUrl } from '@/lib/api';

function SignOutButton({ onSignOut }: { onSignOut?: () => void }) {
  const { logout } = useAuth();

  return (
    <button
      type="button"
      onClick={() => {
        onSignOut?.();
        logout();
      }}
      className="flex w-full items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-all"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      Sign out
    </button>
  );
}

function BrandLink({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/dashboard"
      className={`flex items-center gap-2 no-underline min-w-0 ${className}`}
    >
      <img src="/favicon.svg" alt="resolve logo" className="h-9 w-9 shrink-0" />
      <span className="font-extrabold text-lg text-gray-100 tracking-tight truncate">resolve</span>
    </Link>
  );
}

function SidebarPanel({
  onNavigate,
  className = '',
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col h-full rounded-2xl border border-gray-700/60 bg-gray-900/60 backdrop-blur-xl shadow-2xl overflow-hidden ${className}`}>
      <div className="px-5 pt-6 pb-4 border-b border-gray-800/60 hidden md:flex flex-row gap-3">
        <img src="/favicon.svg" alt="resolve logo" className="h-12 w-12 -mr-2" />
        <Link
          href="/dashboard"
          className="font-extrabold text-xl text-gray-100 tracking-tight no-underline mt-[10px] -ml-[5px]"
        >
          resolve
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 md:py-4">
        <DashboardNav onNavigate={onNavigate} />
      </div>

      <div className="px-4 py-4 border-t border-gray-800/60 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SignOutButton onSignOut={onNavigate} />
      </div>
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    if (!authToken) return;

    fetch(apiUrl('/auth/session'), {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          refreshStoredUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const openMenu = () => {
    setIsDrawerMounted(true);
    requestAnimationFrame(() => {
      setIsDrawerOpen(true);
    });
  };

  const closeMenu = () => {
    setIsDrawerOpen(false);
  };

  const handleDrawerTransitionEnd = (event: React.TransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (!isDrawerOpen) {
      setIsDrawerMounted(false);
    }
  };

  useEffect(() => {
    closeMenu();
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isDrawerMounted ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerMounted]);

  return (
    <ProtectedRoute>
      <NotificationProvider>
        <div
          className="min-h-screen bg-gray-950 flex flex-col md:flex-row"
          style={{ fontFamily: 'var(--font-manrope, Manrope, sans-serif)' }}
        >
          {/* Mobile header */}
          <header className="md:hidden sticky top-0 z-30 flex items-center px-4 py-3 border-b border-gray-700/60 bg-gray-900/90 backdrop-blur-xl shrink-0">
            {!isDrawerMounted ? (
              <button
                type="button"
                onClick={openMenu}
                className="shrink-0 p-2 -ml-2 rounded-lg text-gray-300 hover:text-gray-100 hover:bg-gray-800/60 transition-colors"
                aria-label="Open navigation menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </button>
            ) : (
              <div className="w-9 shrink-0" aria-hidden />
            )}
            <BrandLink className="ml-auto shrink-0" />
          </header>

          {/* Mobile drawer */}
          {isDrawerMounted && (
            <>
              <button
                type="button"
                className={`fixed inset-0 z-40 bg-black/60 md:hidden transition-opacity duration-300 ease-out ${
                  isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={closeMenu}
                aria-label="Close navigation menu"
              />
              <aside
                className={`fixed inset-y-0 left-0 z-50 w-[min(85vw,18rem)] p-3 md:hidden flex flex-col transition-transform duration-300 ease-out ${
                  isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                onTransitionEnd={handleDrawerTransitionEnd}
              >
                <div className="flex items-center justify-between px-2 pb-3 shrink-0">
                  <BrandLink />
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800/60 transition-colors"
                    aria-label="Close menu"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <SidebarPanel onNavigate={closeMenu} className="flex-1 min-h-0" />
              </aside>
            </>
          )}

          {/* Desktop sidebar */}
          <aside className="hidden md:flex w-64 shrink-0 p-3 flex-col sticky top-0 h-screen">
            <SidebarPanel />
          </aside>

          {/* Main content */}
          <main className="flex-1 flex flex-col min-h-0 md:sticky md:top-0 md:h-screen md:p-3">
            <div className="flex-1 flex flex-col md:rounded-2xl md:border md:border-gray-700/60 md:bg-gray-900/60 md:backdrop-blur-xl md:shadow-2xl overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6">{children}</div>
            </div>
          </main>
        </div>
      </NotificationProvider>
    </ProtectedRoute>
  );
}
