'use client';

import ReportsModuleNav from '@/components/reports/ReportsModuleNav';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-100">Report Studio</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Build, run, and schedule configurable reports across every module — including custom fields.
        </p>
      </div>
      <ReportsModuleNav />
      {children}
    </div>
  );
}
