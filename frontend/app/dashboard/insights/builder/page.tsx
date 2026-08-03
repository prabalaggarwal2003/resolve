'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

function InsightBuilderRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  useEffect(() => {
    const target = editId
      ? `/dashboard/insights/rules?edit=${encodeURIComponent(editId)}`
      : '/dashboard/insights/rules?new=1';
    router.replace(target);
  }, [router, editId]);

  return <LoadingSpinner message="Opening configure…" />;
}

/** Legacy route — builder now lives on Configure. */
export default function InsightBuilderRedirectPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Opening configure…" />}>
      <InsightBuilderRedirectInner />
    </Suspense>
  );
}
