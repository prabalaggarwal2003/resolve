'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard/budgets', label: 'Budgets' },
  { href: '/dashboard/budgets/procurement', label: 'Procurement' },
  { href: '/dashboard/budgets/analytics', label: 'Analytics' },
  { href: '/dashboard/budgets/history', label: 'History' },
];

export default function BudgetModuleNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-800/80 pb-1">
      {tabs.map((tab) => {
        const active =
          tab.href === '/dashboard/budgets'
            ? pathname === '/dashboard/budgets' || pathname === '/dashboard/budgets/settings'
            : tab.href === '/dashboard/budgets/history'
              ? pathname.startsWith('/dashboard/budgets/history') || /^\/dashboard\/budgets\/[^/]+$/.test(pathname)
              : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-1.5 text-sm rounded-t-lg no-underline transition-colors ${
              active
                ? 'bg-gray-800/80 text-gray-100 border border-gray-700/60 border-b-transparent -mb-px'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
