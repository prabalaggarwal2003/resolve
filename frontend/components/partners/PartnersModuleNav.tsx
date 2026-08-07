'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard/partners', label: 'Dashboard', match: (p: string) => p === '/dashboard/partners' },
  { href: '/dashboard/partners/list', label: 'All Partners', match: (p: string) => p.startsWith('/dashboard/partners/list') || /^\/dashboard\/partners\/[^/]+$/.test(p) },
  { href: '/dashboard/partners/contracts', label: 'All Contracts', match: (p: string) => p.startsWith('/dashboard/partners/contracts') },
  { href: '/dashboard/partners/purchases', label: 'All Purchases', match: (p: string) => p.startsWith('/dashboard/partners/purchases') },
  { href: '/dashboard/partners/invoices', label: 'All Invoices', match: (p: string) => p.startsWith('/dashboard/partners/invoices') },
  { href: '/dashboard/partners/activity', label: 'Activity', match: (p: string) => p.startsWith('/dashboard/partners/activity') },
  { href: '/dashboard/partners/settings', label: 'Settings', match: (p: string) => p.startsWith('/dashboard/partners/settings') },
];

export default function PartnersModuleNav() {
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
