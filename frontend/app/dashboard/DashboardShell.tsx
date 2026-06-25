'use client';

import Link from 'next/link';
import DashboardNav from './DashboardNav';
import { NotificationProvider } from '@/contexts/NotificationContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

function SignOutButton() {
  const { logout } = useAuth();

  return (
    <button
      type="button"
      onClick={() => logout()}
      className="flex w-full items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-600 hover:text-gray-300 hover:bg-gray-800/60 transition-all"
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

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <NotificationProvider>
        <div
          className="flex min-h-screen bg-gray-950"
          style={{ fontFamily: 'var(--font-manrope, Manrope, sans-serif)' }}
        >
          <aside className="w-64 shrink-0 p-3 flex flex-col sticky top-0 h-screen">
            <div className="flex-1 flex flex-col rounded-2xl border border-gray-700/60 bg-gray-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="px-5 pt-6 pb-4 border-b border-gray-800/60 flex flex-row gap-3">
                <img src="/favicon.svg" alt="resolve logo" className="h-12 w-12 -mr-2" />
                <Link
                  href="/dashboard"
                  className="font-extrabold text-xl text-gray-100 tracking-tight no-underline mt-[10px] -ml-[5px]"
                >
                  resolve
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4">
                <DashboardNav />
              </div>

              <div className="px-4 py-4 border-t border-gray-800/60 space-y-2">
                <SignOutButton />
              </div>
            </div>
          </aside>

          <main className="flex-1 p-3 flex flex-col sticky top-0 h-screen">
            <div className="flex-1 flex flex-col rounded-2xl border border-gray-700/60 bg-gray-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">{children}</div>
            </div>
          </main>
        </div>
      </NotificationProvider>
    </ProtectedRoute>
  );
}
