import Link from 'next/link';
import DashboardNav from './DashboardNav';
import { NotificationProvider } from '@/contexts/NotificationContext';
import DarkModeToggle from '@/components/DarkModeToggle';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationProvider>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
        <aside className="w-60 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 p-6 flex flex-col">
          <Link href="/dashboard" className="font-bold text-xl text-slate-900 dark:text-gray-100">
            Resolve
          </Link>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Schools & Colleges</p>
          <DashboardNav />
          <div className="mt-auto pt-6 space-y-3">
            <DarkModeToggle />
            <Link href="/" className="text-sm text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 block">
              Sign out
            </Link>
          </div>
        </aside>
        <main className="flex-1 p-6 overflow-auto bg-gray-50 dark:bg-gray-900">{children}</main>
      </div>
    </NotificationProvider>
  );
}
