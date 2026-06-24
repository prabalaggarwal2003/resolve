'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { validateEmail, validatePassword, validateOtp, getPasswordStrength } from '@/lib/validation';
import { apiUrl } from '@/lib/api';

const inputClass =
  'w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent transition-all text-sm';
const labelClass = 'block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2';

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState(getPasswordStrength(''));

  const resetMessages = () => {
    setError('');
    setSuccess('');
    setFieldErrors({});
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const emailError = validateEmail(email);
      if (emailError) {
        setFieldErrors({ email: emailError });
        return;
      }
      const res = await fetch(apiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send code');
      setSuccess(data.message);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const errors: Record<string, string> = {};
      const otpError = validateOtp(otpCode);
      if (otpError) errors.otp = otpError;
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      const res = await fetch(apiUrl('/auth/verify-reset-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid code');
      setResetToken(data.resetToken);
      setSuccess('Code verified. Set your new password.');
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const errors: Record<string, string> = {};
      const passwordError = validatePassword(password);
      if (passwordError) errors.password = passwordError;
      if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      const res = await fetch(apiUrl('/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password');
      setSuccess(data.message);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    resetMessages();
    setResendLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend code');
      setSuccess('New code sent. Check your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  const stepTitle =
    step === 1 ? 'Forgot password' : step === 2 ? 'Enter verification code' : 'Set new password';
  const stepSubtitle =
    step === 1
      ? 'Enter your registered email to receive a reset code'
      : step === 2
        ? `We sent a 6-digit code to ${email}`
        : 'Choose a strong password for your account';

  return (
    <main
      className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ fontFamily: 'var(--font-manrope, Manrope, sans-serif)' }}
    >
      <div className="absolute top-[-180px] left-[-180px] w-[500px] h-[500px] rounded-full bg-gray-700/20 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-160px] right-[-160px] w-[460px] h-[460px] rounded-full bg-gray-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mb-6">
        <Link href="/login" className="text-md text-gray-600 hover:text-gray-300 transition-colors no-underline">
          ← Back to sign in
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-gray-700/60 bg-gray-900/40 backdrop-blur-xl shadow-2xl px-8 py-10">
        <div className="mb-8">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800/70 border border-gray-700/60 text-xs font-semibold text-gray-400 tracking-widest uppercase mb-4">
            Step {step} of 3
          </span>
          <h1 className="text-3xl font-extrabold text-gray-100 tracking-tight">{stepTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">{stepSubtitle}</p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-900/20 border border-red-800/60 text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-5 p-3 bg-green-900/20 border border-green-800/60 text-green-400 rounded-xl text-sm">
            {success}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@organisation.com"
                className={`${inputClass} ${fieldErrors.email ? 'border-red-500/60' : ''}`}
              />
              {fieldErrors.email && <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send verification code →'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label className={labelClass}>Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="000000"
                className={`${inputClass} text-center text-xl tracking-[0.5em] ${fieldErrors.otp ? 'border-red-500/60' : ''}`}
              />
              {fieldErrors.otp && <p className="text-red-400 text-xs mt-1">{fieldErrors.otp}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify code →'}
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendLoading}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              {resendLoading ? 'Resending…' : "Didn't get a code? Resend"}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className={labelClass}>New password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordStrength(getPasswordStrength(e.target.value));
                  }}
                  required
                  placeholder="••••••••"
                  className={`${inputClass} pr-11 ${fieldErrors.password ? 'border-red-500/60' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}
              {password && (
                <p
                  className={`text-xs mt-2 font-semibold ${
                    passwordStrength.score >= 5
                      ? 'text-green-400'
                      : passwordStrength.score >= 3
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  }`}
                >
                  Strength: {passwordStrength.score >= 5 ? 'Strong' : passwordStrength.score >= 3 ? 'Good' : 'Weak'}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={`${inputClass} pr-11 ${fieldErrors.confirmPassword ? 'border-red-500/60' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">{fieldErrors.confirmPassword}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Update password →'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
