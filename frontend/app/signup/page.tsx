'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { validateEmail, validatePassword, validateName, validateOtp, getPasswordStrength } from '@/lib/validation';
import { apiUrl } from '@/lib/api';

const INDUSTRIES = [
  { value: 'IT', label: 'Information Technology' },
  { value: 'Construction', label: 'Construction' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Education', label: 'Education' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Other', label: 'Other' },
];

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-1000', label: '201-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

const inputClass = 'w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent transition-all text-sm';
const labelClass = 'block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2';

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [createdOrg, setCreatedOrg] = useState<any>(null);

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(getPasswordStrength(''));

  const [otpCode, setOtpCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const router = useRouter();

  const resetError = () => setError('');
  const resetFieldErrors = () => setFieldErrors({});

  const handlePasswordChange = (value: string) => {
    setAdminPassword(value);
    setPasswordStrength(getPasswordStrength(value));
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault(); resetError(); resetFieldErrors(); setLoading(true);
    try {
      const errors: Record<string, string> = {};
      if (!orgName.trim()) errors.orgName = 'Organization name is required';
      if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
      const res = await fetch(apiUrl('/auth/signup/create-organization'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName: orgName.trim(), industry: industry || undefined, companySize: companySize || undefined, country: country.trim() || undefined, region: region.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create organization');
      setCreatedOrg(data.organization); setSuccess(data.message); setStep(2);
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault(); resetError(); resetFieldErrors(); setLoading(true);
    try {
      const errors: Record<string, string> = {};
      const nameError = validateName(adminName); if (nameError) errors.adminName = nameError;
      const emailError = validateEmail(adminEmail); if (emailError) errors.adminEmail = emailError;
      if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
      const res = await fetch(apiUrl('/auth/signup/send-admin-otp'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: createdOrg.id, name: adminName.trim(), email: adminEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send verification code');
      if (data.organization) setCreatedOrg(data.organization);
      setSuccess(data.message); setStep(3);
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault(); resetError(); resetFieldErrors(); setLoading(true);
    try {
      const errors: Record<string, string> = {};
      const otpError = validateOtp(otpCode); if (otpError) errors.otp = otpError;
      const passwordError = validatePassword(adminPassword); if (passwordError) errors.password = passwordError;
      if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
      const res = await fetch(apiUrl('/auth/signup/verify-admin-otp'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail.trim(), code: otpCode.trim(), password: adminPassword, organizationId: createdOrg?.id, name: adminName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create administrator');
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
      }
      setSuccess(data.message);
      setTimeout(() => router.push('/onboarding'), 1500);
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    resetError(); resetFieldErrors(); setResendLoading(true); setResendMessage('');
    try {
      const res = await fetch(apiUrl('/auth/signup/send-admin-otp'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: createdOrg.id, name: adminName.trim(), email: adminEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend code');
      setResendMessage('New code sent! Check your email.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to resend code'); }
    finally { setResendLoading(false); }
  };

  const stepLabels = ['Organisation', 'Admin', 'Verify'];

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
        <Link href="/" className="text-md text-gray-600 hover:text-gray-300 transition-colors no-underline">← resolve</Link>
      </div>

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-gray-700/60 bg-gray-900/40 backdrop-blur-xl shadow-2xl px-8 py-10">

        {/* Header */}
        <div className="mb-8">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800/70 border border-gray-700/60 text-xs font-semibold text-gray-400 tracking-widest uppercase mb-4">
            {step === 1 ? 'Get started' : step === 2 ? 'Admin account' : 'Verify email'}
          </span>
          <h1 className="text-3xl font-extrabold text-gray-100 tracking-tight">
            {step === 1 ? 'Create organisation' : step === 2 ? 'Set up admin' : 'Check your inbox'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 1 ? 'Start by telling us about your organisation' : step === 2 ? 'Create your administrator account' : `We sent a 6-digit code to ${adminEmail}`}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all
                  ${done ? 'bg-green-900/30 text-green-400 border border-green-800/50' :
                    active ? 'bg-gray-700/80 text-gray-100 border border-gray-600/60' :
                    'bg-gray-800/40 text-gray-600 border border-gray-700/40'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs
                    ${done ? 'bg-green-500 text-white' : active ? 'bg-gray-400 text-gray-900' : 'bg-gray-700 text-gray-500'}`}>
                    {done ? '✓' : n}
                  </span>
                  {label}
                </div>
                {i < 2 && <div className={`w-4 h-px ${step > n ? 'bg-green-700' : 'bg-gray-700'}`} />}
              </div>
            );
          })}
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/20 border border-red-800/60 text-red-400 rounded-xl text-sm">{error}</div>}
        {success && step !== 3 && <div className="mb-4 p-3 bg-green-900/20 border border-green-800/60 text-green-400 rounded-xl text-sm">{success}</div>}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <label className={labelClass}>Organisation Name *</label>
              <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} required
                placeholder="e.g. Acme University"
                className={`${inputClass} ${fieldErrors.orgName ? 'border-red-500/60' : ''}`} />
              {fieldErrors.orgName && <p className="text-red-400 text-xs mt-1">{fieldErrors.orgName}</p>}
            </div>
            <div>
              <label className={labelClass}>Industry</label>
              <select value={industry} onChange={e => setIndustry(e.target.value)} className={inputClass}>
                <option value="">Select industry</option>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Organisation Size</label>
              <select value={companySize} onChange={e => setCompanySize(e.target.value)} className={inputClass}>
                <option value="">Select size</option>
                {COMPANY_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Country</label>
                <input type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. India" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Region / State</label>
                <input type="text" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Delhi" className={inputClass} />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              {loading ? 'Creating organisation…' : 'Continue →'}
            </button>
          </form>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-4">
            {createdOrg && (
              <div className="p-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-sm">
                <p className="text-gray-300 font-semibold">{createdOrg.name}</p>
                <p className="text-gray-600 text-xs mt-0.5">ID: {createdOrg.orgId}</p>
              </div>
            )}
            <div>
              <label className={labelClass}>Your Name *</label>
              <input type="text" value={adminName} onChange={e => setAdminName(e.target.value)} required
                placeholder="e.g. John Doe"
                className={`${inputClass} ${fieldErrors.adminName ? 'border-red-500/60' : ''}`} />
              {fieldErrors.adminName && <p className="text-red-400 text-xs mt-1">{fieldErrors.adminName}</p>}
            </div>
            <div>
              <label className={labelClass}>Email Address *</label>
              <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required
                placeholder="you@organisation.com"
                className={`${inputClass} ${fieldErrors.adminEmail ? 'border-red-500/60' : ''}`} />
              {fieldErrors.adminEmail && <p className="text-red-400 text-xs mt-1">{fieldErrors.adminEmail}</p>}
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              {loading ? 'Sending code…' : 'Send verification code →'}
            </button>
          </form>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <form onSubmit={handleStep3} className="space-y-4">
            {createdOrg && (
              <div className="p-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-sm">
                <p className="text-gray-300 font-semibold">{createdOrg.name}</p>
                <p className="text-gray-600 text-xs mt-0.5">{adminName} · {adminEmail}</p>
              </div>
            )}
            <div>
              <label className={labelClass}>Verification Code *</label>
              <input type="text" value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required maxLength={6} placeholder="000000"
                className={`${inputClass} text-center text-xl tracking-[0.5em] ${fieldErrors.otp ? 'border-red-500/60' : ''}`} />
              {fieldErrors.otp && <p className="text-red-400 text-xs mt-1">{fieldErrors.otp}</p>}
              <p className="text-xs text-gray-600 mt-1 text-center">In development you can use <span className="text-gray-400 font-semibold">123456</span></p>
            </div>
            <div>
              <label className={labelClass}>Set Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={e => handlePasswordChange(e.target.value)}
                  required placeholder="Min 8 chars, uppercase, numbers, symbols"
                  className={`${inputClass} pr-11 ${fieldErrors.password ? 'border-red-500/60' : ''}`} />
                <button type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}
              {/* Strength meter */}
              <div className="mt-2">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-600">Strength</span>
                  <span className={`text-xs font-semibold ${passwordStrength.score >= 5 ? 'text-green-400' : passwordStrength.score >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {passwordStrength.score >= 5 ? 'Strong' : passwordStrength.score >= 3 ? 'Medium' : 'Weak'}
                  </span>
                </div>
                <div className="w-full bg-gray-700/60 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.score >= 5 ? 'bg-green-500' : passwordStrength.score >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min((passwordStrength.score / 6) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              {loading ? 'Creating account…' : 'Create account →'}
            </button>
            <div className="text-center pt-1">
              <p className="text-xs text-gray-600 mb-1">Didn't receive the code?</p>
              <button type="button" onClick={handleResendOtp} disabled={resendLoading}
                className="text-gray-400 hover:text-gray-200 text-xs font-semibold transition-colors disabled:opacity-50">
                {resendLoading ? 'Sending…' : 'Resend code'}
              </button>
              {resendMessage && <p className="text-xs text-green-400 mt-1">{resendMessage}</p>}
            </div>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-gray-300 font-semibold hover:text-white transition-colors no-underline ml-[2px]">Sign in</Link>
        </p>
      </div>

      {/*<p className="relative z-10 mt-6 text-xs text-gray-700">Free to use · No credit card required</p>*/}
    </main>
  );
}
