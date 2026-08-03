'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

/** Asset Health module has been retired — redirect away from deep links. */
export default function AssetHealthPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return <LoadingSpinner message="Redirecting…" />;
}
