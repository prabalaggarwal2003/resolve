'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AssetHealthProfilesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/asset-health/settings');
  }, [router]);

  return <LoadingSpinner message="Group profiles moved to Settings…" />;
}
