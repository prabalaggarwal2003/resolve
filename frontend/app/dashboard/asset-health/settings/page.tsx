'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

/** Asset Health settings have been retired — redirect away from deep links. */
export default function AssetHealthSettingsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return <LoadingSpinner message="Redirecting…" />;
}
