'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

/** Legacy route — thresholds now live under Configure. */
export default function InsightThresholdsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/insights/rules#defaults');
  }, [router]);

  return <LoadingSpinner message="Opening configure…" />;
}
