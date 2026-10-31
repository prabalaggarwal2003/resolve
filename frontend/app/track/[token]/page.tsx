'use client';

import { useParams } from 'next/navigation';
import { TrackPageShell } from '@/components/issues/TrackReportView';

export default function TrackByTokenPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';
  return <TrackPageShell initialToken={token} />;
}
