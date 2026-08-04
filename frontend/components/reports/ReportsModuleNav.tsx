'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard/reports', label: 'Dashboard', match: (p: string) => p === '/dashboard/reports' },
  { href: '/dashboard/reports/quick', label: 'Quick Reports', match: (p: string) => p.startsWith('/dashboard/reports/quick') },
  { href: '/dashboard/reports/builder', label: 'Builder', match: (p: string) => p.startsWith('/dashboard/reports/builder') },
  { href: '/dashboard/reports/drafts', label: 'Drafts', match: (p: string) => p.startsWith('/dashboard/reports/drafts') },
  { href: '/dashboard/reports/saved', label: 'Saved', match: (p: string) => p.startsWith('/dashboard/reports/saved') },
  { href: '/dashboard/reports/scheduled', label: 'Scheduled', match: (p: string) => p.startsWith('/dashboard/reports/scheduled') },
  { href: '/dashboard/reports/templates', label: 'Templates', match: (p: string) => p.startsWith('/dashboard/reports/templates') },
  { href: '/dashboard/reports/history', label: 'Export History', match: (p: string) => p.startsWith('/dashboard/reports/history') },
  { href: '/dashboard/reports/settings', label: 'Settings', match: (p: string) => p.startsWith('/dashboard/reports/settings') },
  { href: '/dashboard/reports/period', label: 'Issue Periods', match: (p: string) => p.startsWith('/dashboard/reports/period') },
];

export default function ReportsModuleNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-800/80 pb-1 mb-4 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-1.5 text-sm rounded-t-lg no-underline whitespace-nowrap transition-colors ${
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
