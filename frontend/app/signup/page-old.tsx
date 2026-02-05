'use client';

import { useState } from 'react';
import Link from 'next/link';
import { validateEmail, validatePassword, validateName, validateOrganizationName, validateOtp, getPasswordStrength } from '../../lib/validation';

const INDUSTRIES = ['IT', 'Construction', 'Healthcare', 'Education', 'Manufacturing', 'Retail', 'Other'];
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
const PRIMARY_GOALS = [
  { value: 'track_it_assets', label: 'Track IT assets' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'other', label: 'Other' },
];
const ESTIMATED_ASSETS = ['1-50', '51-200', '201-500', '501-1000', '1000+'];

const inputClass =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';
const labelClass = 'block mb-2 font-medium text-slate-700';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  // Step 1
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(getPasswordStrength(''));
  // Step 2
  const [otpCode, setOtpCode] = useState('');
  // Step 3
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  // Step 4
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [estimatedAssets, setEstimatedAssets] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');

  const resetError = () => setError('');
  const resetFieldErrors = () => setFieldErrors({});

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordStrength(getPasswordStrength(value));
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    resetFieldErrors();
    setLoading(true);
    
    try {
      // Validate all fields
      const errors: Record<string, string> = {};
      
      const nameError = validateName(name);
      if (nameError) errors.name = nameError;
      
      const emailError = validateEmail(email);
      if (emailError) errors.email = emailError;
      
      const passwordError = validatePassword(password);
      if (passwordError) errors.password = passwordError;
      
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      const res = await fetch(api('/api/auth/signup/account'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create account');
      setEmail(data.email || email);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    resetError();
    resetFieldErrors();
    setResendLoading(true);
    setResendMessage('');
    
    try {
      const res = await fetch(api('/api/auth/signup/resend-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend code');
      setResendMessage('New code sent! Check your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setLoading(true);
    try {
      // Validate inputs
      const errors: Record<string, string> = {};
      
      const emailError = validateEmail(email);
      if (emailError) errors.email = emailError;
      
      const otpError = validateOtp(otpCode);
      if (otpError) errors.otp = otpError;
      
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      const res = await fetch(api('/api/auth/signup/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid code');
      
      setToken(data.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      // Show success message and proceed to organization step
      if (data.message) {
        setSuccess(data.message);
      }
      
      setStep(3); // Always go to step 3 (organization) after OTP verification
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch(api('/api/auth/signup/organization'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgName: orgName.trim(),
          industry: industry || undefined,
          companySize: companySize || undefined,
          country: country.trim() || undefined,
          region: region.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save organization');
      
      // Update user data in localStorage with the new organization info
      if (typeof window !== 'undefined' && data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      // Show success message
      if (data.message) {
        setSuccess(data.message);
      }
      
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleStep4 = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setSuccess('');
    setLoading(true);
    try {
      const emails = inviteEmails
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(api('/api/auth/signup/preferences'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          primaryGoal: primaryGoal || undefined,
          estimatedAssets: estimatedAssets || undefined,
          inviteEmails: emails.length ? emails : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save preferences');
      
      // Show success message
      if (data.message) {
        setSuccess(data.message);
      }
      
      setOrgName(data.orgName || orgName);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const goToOnboarding = () => {
    window.location.href = '/onboarding';
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="text-xl font-bold mb-1">Create your account</h1>
            <p className="text-slate-600 mb-6">Admin name, work email, and password.</p>
            <form onSubmit={handleStep1}>
              {error && (
                <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
              )}
              {success && (
                <p className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">{success}</p>
              )}
              <label className={labelClass}>Your name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={`${inputClass + ' mb-4'} ${fieldErrors.name ? 'border-red-500' : ''}`}
                placeholder="e.g. Jane Smith"
              />
              {fieldErrors.name && (
                <p className="mb-4 text-red-600 text-sm">{fieldErrors.name}</p>
              )}
              
              <label className={labelClass}>Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`${inputClass + ' mb-4'} ${fieldErrors.email ? 'border-red-500' : ''}`}
                placeholder="you@company.com"
              />
              {fieldErrors.email && (
                <p className="mb-4 text-red-600 text-sm">{fieldErrors.email}</p>
              )}
              
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                className={`${inputClass + ' mb-2'} ${fieldErrors.password ? 'border-red-500' : ''}`}
                placeholder="Min 8 chars: uppercase, lowercase, numbers, symbols"
              />
              {fieldErrors.password && (
                <p className="mb-4 text-red-600 text-sm">{fieldErrors.password}</p>
              )}
              
              {password && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-slate-600">Password strength:</span>
                    <span className={`text-sm font-medium ${
                      passwordStrength.color === 'green' ? 'text-green-600' :
                      passwordStrength.color === 'yellow' ? 'text-yellow-600' :
                      passwordStrength.color === 'orange' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {passwordStrength.score <= 2 ? 'Weak' :
                       passwordStrength.score <= 4 ? 'Medium' : 'Strong'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        passwordStrength.color === 'green' ? 'bg-green-600' :
                        passwordStrength.color === 'yellow' ? 'bg-yellow-600' :
                        passwordStrength.color === 'orange' ? 'bg-orange-600' :
                        'bg-red-600'
                      }`}
                      style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                    />
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Add: {passwordStrength.feedback.join(', ')}
                    </p>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-primary-hover"
              >
                {loading ? 'Sending code…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-xl font-bold mb-1">Verify your email</h1>
            <p className="text-slate-600 mb-6">
              We sent a 6-digit code to <strong>{email}</strong>. Check your inbox (and spam). In dev you can use <strong>123456</strong>.
            </p>
            <form onSubmit={handleStep2}>
              {error && (
                <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
              )}
              {success && (
                <p className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">{success}</p>
              )}
              <label className={labelClass}>Verification code</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                className={inputClass + ' mb-6 text-center text-lg tracking-widest'}
                placeholder="000000"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-primary-hover"
              >
                {loading ? 'Verifying…' : 'Verify & continue'}
              </button>
              {resendMessage && (
                <p className="mt-3 text-green-600 text-sm text-center">{resendMessage}</p>
              )}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendLoading}
                className="w-full mt-3 py-2 text-slate-600 text-sm hover:text-primary disabled:opacity-60"
              >
                {resendLoading ? 'Sending…' : 'Resend code'}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full mt-2 py-2 text-slate-500 text-sm hover:text-slate-700"
              >
                Use a different email
              </button>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-xl font-bold mb-1">Tell us about your organization</h1>
            <p className="text-slate-600 mb-6">Light but important — we use this to tailor your experience.</p>
            <form onSubmit={handleStep3}>
              {error && (
                <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
              )}
              {success && (
                <p className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">{success}</p>
              )}
              <label className={labelClass}>Organization name *</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className={inputClass + ' mb-4'}
                placeholder="e.g. Acme School"
              />
              <label className={labelClass}>Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className={inputClass + ' mb-4'}
              >
                <option value="">Select</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
              <label className={labelClass}>Company size</label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className={inputClass + ' mb-4'}
              >
                <option value="">Select</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>{s} employees</option>
                ))}
              </select>
              <label className={labelClass}>Country / region</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputClass + ' mb-2'}
                placeholder="e.g. India"
              />
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className={inputClass + ' mb-6'}
                placeholder="State / region (optional)"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-primary-hover"
              >
                {loading ? 'Saving…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-xl font-bold mb-1">Your goals & setup</h1>
            <p className="text-slate-600 mb-6">What do you want to solve first? (Optional — you can skip.)</p>
            <form onSubmit={handleStep4}>
              {error && (
                <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
              )}
              {success && (
                <p className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">{success}</p>
              )}
              <label className={labelClass}>Primary goal</label>
              <select
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
                className={inputClass + ' mb-4'}
              >
                <option value="">Select</option>
                {PRIMARY_GOALS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              <label className={labelClass}>Estimated number of assets to track</label>
              <select
                value={estimatedAssets}
                onChange={(e) => setEstimatedAssets(e.target.value)}
                className={inputClass + ' mb-4'}
              >
                <option value="">Select</option>
                {ESTIMATED_ASSETS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <label className={labelClass}>Invite teammates (optional)</label>
              <input
                type="text"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                className={inputClass + ' mb-6'}
                placeholder="emails separated by comma"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-primary-hover"
              >
                {loading ? 'Saving…' : 'Done'}
              </button>
            </form>
          </>
        )}

        {step === 5 && (
          <>
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2">You&apos;re all set!</h1>
              <p className="text-slate-600 mb-6">
                Welcome, <strong>{orgName}</strong>! Let&apos;s get your assets set up.
              </p>
              <button
                onClick={goToOnboarding}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover"
              >
                Start setup wizard
              </button>
              <Link
                href="/dashboard"
                className="block mt-3 text-slate-600 text-sm hover:text-slate-900"
              >
                Skip to dashboard
              </Link>
            </div>
          </>
        )}

        {step < 5 && (
          <p className="mt-6 text-slate-500 text-sm text-center">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        )}
      </div>
    </main>
  );
}
