import { redirect } from 'next/navigation';

export default function VendorsRedirect() {
  redirect('/dashboard/partners/list');
}
