'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Documents module is paused — redirect to partners home. */
export default function PartnerDocumentsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/partners');
  }, [router]);
  return null;
}
