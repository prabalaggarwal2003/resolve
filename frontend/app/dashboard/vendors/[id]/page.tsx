'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VendorDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');

  useEffect(() => {
    if (id) router.replace(`/dashboard/partners/${id}`);
  }, [id, router]);

  return (
    <div className="text-sm text-gray-400 p-4">
      Redirecting to partner profile…
    </div>
  );
}
