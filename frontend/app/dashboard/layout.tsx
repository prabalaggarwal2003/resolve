import Link from 'next/link';
import DashboardNav from './DashboardNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-white border-r border-slate-200 p-6 flex flex-col">
        <Link href="/dashboard" className="font-bold text-xl text-slate-900">
          Resolve
        </Link>
        <p className="text-xs text-slate-500 mt-1">Schools & Colleges</p>
        <DashboardNav />
        <div className="mt-auto pt-6">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
            Sign out
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
