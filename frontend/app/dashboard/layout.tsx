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
      <div className="flex min-h-screen bg-gray-900">
        <aside className="w-60 bg-gray-800 border-r border-gray-700 p-6 flex flex-col">
          <Link href="/dashboard" className="font-bold text-xl text-gray-100">
            Resolve
          </Link>
          <p className="text-xs text-gray-500 mt-1">Schools & Colleges</p>
          <DashboardNav />
          <div className="mt-auto pt-6 space-y-3">
            <DarkModeToggle />
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 block">
              Sign out
            </Link>
          </div>
        </aside>
        <main className="flex-1 p-6 overflow-auto bg-gray-900">{children}</main>
      </div>
    </NotificationProvider>
  );
}
