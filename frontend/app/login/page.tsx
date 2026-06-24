'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

type LoginStep = 'credentials' | 'twoFactor' | 'recovery';

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preAuthToken, setPreAuthToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const completeLogin = (data: { token: string; user: unknown }) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.removeItem('loggedOut');
    window.location.href = '/dashboard';
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      if (data.requiresTwoFactor) {
        setPreAuthToken(data.preAuthToken);
        setStep('twoFactor');
        return;
      }

      completeLogin(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/2fa/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preAuthToken,
          email: email.trim(),
          code: twoFactorCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      completeLogin(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/2fa/recovery'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preAuthToken,
          email: email.trim(),
          recoveryCode: recoveryCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Recovery failed');
      completeLogin(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  const backToCredentials = () => {
    setStep('credentials');
    setPreAuthToken('');
    setTwoFactorCode('');
    setRecoveryCode('');
    setError('');
  };

  const title =
    step === 'credentials' ? 'Sign in' : step === 'twoFactor' ? 'Two-factor authentication' : 'Use recovery code';
  const subtitle =
    step === 'credentials'
      ? "Access your organisation's dashboard"
      : step === 'twoFactor'
        ? 'Enter the 6-digit code from your authenticator app'
        : 'Enter one of your one-time recovery codes';

  return (
    <main
      className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ fontFamily: 'var(--font-manrope, Manrope, sans-serif)' }}
    >
      <div className="absolute top-[-180px] left-[-180px] w-[500px] h-[500px] rounded-full bg-gray-700/20 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-160px] right-[-160px] w-[460px] h-[460px] rounded-full bg-gray-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mb-6">
        <Link href="/" className="text-md text-gray-600 hover:text-gray-300 transition-colors no-underline">
          ← resolve
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-gray-700/60 bg-gray-900/40 backdrop-blur-xl shadow-2xl px-8 py-10">
        <div className="mb-8">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800/70 border border-gray-700/60 text-xs font-semibold text-gray-400 tracking-widest uppercase mb-4">
            {step === 'credentials' ? 'Welcome back' : 'Secure sign in'}
          </span>
          <h1 className="text-3xl font-extrabold text-gray-100 tracking-tight">{title}</h1>
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-900/20 border border-red-800/60 text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-5">
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
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex justify-end mt-2">
                <Link
                  href="/forgot-password"
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors no-underline"
                >
                  Forgot password?
                </Link>
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
        )}

        {step === 'twoFactor' && (
          <form onSubmit={handleTwoFactorSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Authenticator code
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="000000"
                className="w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600 text-center text-xl tracking-[0.4em]"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify & sign in →'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('recovery');
                setError('');
              }}
              className="w-full text-xs text-gray-500 hover:text-gray-300"
            >
              Use a recovery code instead
            </button>
            <button type="button" onClick={backToCredentials} className="w-full text-xs text-gray-600 hover:text-gray-400">
              ← Back to sign in
            </button>
          </form>
        )}

        {step === 'recovery' && (
          <form onSubmit={handleRecoverySubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Recovery code
              </label>
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                required
                placeholder="XXXX-XXXX"
                className="w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600 text-center tracking-widest uppercase"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Sign in with recovery code →'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('twoFactor');
                setError('');
              }}
              className="w-full text-xs text-gray-500 hover:text-gray-300"
            >
              Use authenticator app instead
            </button>
            <button type="button" onClick={backToCredentials} className="w-full text-xs text-gray-600 hover:text-gray-400">
              ← Back to sign in
            </button>
          </form>
        )}

        {step === 'credentials' && (
          <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-gray-300 font-semibold hover:text-white transition-colors no-underline ml-[2px]">
              Create one
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
