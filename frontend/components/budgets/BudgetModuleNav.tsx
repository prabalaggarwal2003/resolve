'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const RESERVED = new Set(['analytics', 'procurement', 'history', 'settings']);

const tabs = [
  {
    href: '/dashboard/budgets/analytics',
    label: 'Analytics',
    match: (path: string) => path.startsWith('/dashboard/budgets/analytics'),
  },
  {
    href: '/dashboard/budgets',
    label: 'Budgets',
    match: (path: string) => {
      if (path === '/dashboard/budgets' || path === '/dashboard/budgets/settings') return true;
      const m = path.match(/^\/dashboard\/budgets\/([^/]+)$/);
      return Boolean(m && !RESERVED.has(m[1]));
    },
  },
  {
    href: '/dashboard/budgets/procurement',
    label: 'Procurement',
    match: (path: string) => path.startsWith('/dashboard/budgets/procurement'),
  },
  {
    href: '/dashboard/budgets/history',
    label: 'History',
    match: (path: string) => path.startsWith('/dashboard/budgets/history'),
  },
];

export default function BudgetModuleNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-800/80 pb-1">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
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
