'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Partner reports live in Report Studio quick templates. */
export default function PartnerReportsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/reports/quick');
  }, [router]);
  return null;
}
