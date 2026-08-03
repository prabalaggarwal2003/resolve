'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard/insights', label: 'Dashboard', match: (path: string) => path === '/dashboard/insights' },
  {
    href: '/dashboard/insights/rules',
    label: 'Configure',
    match: (path: string) =>
      path.startsWith('/dashboard/insights/rules')
      || path.startsWith('/dashboard/insights/builder')
      || path.startsWith('/dashboard/insights/thresholds'),
  },
];

export default function InsightsModuleNav() {
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
