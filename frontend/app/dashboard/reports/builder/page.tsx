'use client';

import { Suspense } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import ReportBuilderInner from './ReportBuilderInner';

export default function ReportBuilderPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading report builder…" />}>
      <ReportBuilderInner />
    </Suspense>
  );
}
