'use client';

import PartnersModuleNav from '@/components/partners/PartnersModuleNav';

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-100">Business Partners</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage vendors, suppliers, manufacturers, and every external organization you work with.
        </p>
      </div>
      <PartnersModuleNav />
      {children}
    </div>
  );
}
