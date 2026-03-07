'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login` : '/api/auth/login';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-700">
        <h1 className="text-xl font-bold mb-2 text-gray-100">Sign in</h1>
        <p className="text-gray-400 mb-6">Schools & colleges — sign in to manage assets</p>
        <form onSubmit={handleSubmit}>
          {error && (
            <p className="mb-4 p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-lg text-sm">{error}</p>
          )}
          <label className="block mb-2 font-medium text-gray-300">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
          />
          <label className="block mb-2 font-medium text-gray-300">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gray-700 text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-gray-600"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-gray-400 text-sm">
          <Link href="/" className="text-gray-300 hover:text-white no-underline">Back to home</Link> · <Link href="/signup" className="text-gray-300 hover:text-white no-underline">Create account</Link>
        </p>
      </div>
    </main>
  );
}
