import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Resolve — Asset Management for Schools & Colleges',
  description: 'Manage assets, report issues, and track maintenance for your institution.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
