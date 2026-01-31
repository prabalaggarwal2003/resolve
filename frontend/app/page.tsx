import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-50 to-white">
      <h1 className="text-4xl font-bold mb-3 text-slate-900">Resolve</h1>
      <p className="text-slate-600 mb-8 max-w-lg text-lg">
        Asset management for schools, colleges & organizations. Track equipment, report issues, and keep everything running.
      </p>
      <Link
        href="/signup"
        className="inline-flex items-center justify-center px-8 py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary-hover shadow-md hover:shadow-lg transition-all"
      >
        Sign up your organization free
      </Link>
      <div className="mt-8 flex gap-4 flex-wrap justify-center">
        <Link
          href="/login"
          className="px-6 py-3 text-slate-700 font-medium hover:text-primary"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
