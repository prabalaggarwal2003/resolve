import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-950">
      <h1 className="text-4xl font-bold mb-3 text-gray-100">Resolve</h1>
      <p className="text-gray-400 mb-8 max-w-lg text-lg">
        Asset management for schools, colleges & organizations. Track equipment, report issues, and keep everything running.
      </p>
      <Link
        href="/signup"
        className="inline-flex items-center justify-center px-8 py-4 bg-gray-700 text-white rounded-xl font-semibold text-lg hover:bg-gray-600 shadow-md hover:shadow-lg transition-all no-underline"
      >
        Sign up your organization free
      </Link>
      <div className="mt-8 flex gap-4 flex-wrap justify-center">
        <Link
          href="/login"
          className="px-6 py-3 text-gray-400 font-medium hover:text-gray-200 no-underline"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
