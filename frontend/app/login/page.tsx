'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      // Clear the logout flag on successful login
      localStorage.removeItem('loggedOut');
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ fontFamily: 'var(--font-manrope, Manrope, sans-serif)' }}
    >
      {/* Ambient blobs */}
      <div className="absolute top-[-180px] left-[-180px] w-[500px] h-[500px] rounded-full bg-gray-700/20 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-160px] right-[-160px] w-[460px] h-[460px] rounded-full bg-gray-600/10 blur-[120px] pointer-events-none" />

      {/* Back link */}
      <div className="relative z-10 w-full max-w-md mb-6">
        <Link href="/" className="text-md text-gray-600 hover:text-gray-300 transition-colors no-underline">
          ← resolve
        </Link>
      </div>

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-gray-700/60 bg-gray-900/40 backdrop-blur-xl shadow-2xl px-8 py-10">

        {/* Header */}
        <div className="mb-8">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800/70 border border-gray-700/60 text-xs font-semibold text-gray-400 tracking-widest uppercase mb-4">
            Welcome back
          </span>
          <h1 className="text-3xl font-extrabold text-gray-100 tracking-tight">Sign in</h1>
          <p className="text-gray-500 text-sm mt-1">Access your organisation's dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800/60 text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@organisation.com"
              className="w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-11 rounded-xl bg-gray-800/60 border border-gray-700/60 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  // Eye-off icon
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  // Eye icon
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link href="/signup" className="text-gray-300 font-semibold hover:text-white transition-colors no-underline ml-[2px]">
            Create one
          </Link>
        </p>
      </div>

      {/*<p className="relative z-10 mt-6 text-xs text-gray-700">*/}
      {/*  Secure sign in · Your data stays private*/}
      {/*</p>*/}
    </main>
  );
}
