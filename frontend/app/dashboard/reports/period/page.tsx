import { redirect } from 'next/navigation';

/** Issue Periods was removed from Report Studio; send bookmarks to the dashboard. */
export default function IssuePeriodsRedirectPage() {
  redirect('/dashboard/reports');
}
