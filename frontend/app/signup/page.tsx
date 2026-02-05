'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { validateEmail, validatePassword, validateName, validateOtp } from '@/lib/validation';
import { getPasswordStrength } from '@/lib/validation';
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

const buttonClass = 'w-full py-3 px-4 rounded-lg font-semibold transition-colors';
const inputClass = 'w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const labelClass = 'block text-sm font-medium text-slate-700 mb-2';

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Organization details (Step 1)
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [createdOrg, setCreatedOrg] = useState<any>(null);

  // Admin details (Step 2)
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(getPasswordStrength(''));

  // OTP verification (Step 3)
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

  // Step 1: Create Organization
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    resetFieldErrors();
    setLoading(true);
    
    try {
      const errors: Record<string, string> = {};
      if (!orgName.trim()) errors.orgName = 'Organization name is required';
      
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      const res = await fetch(apiUrl('/auth/signup/create-organization'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName.trim(),
          industry: industry || undefined,
          companySize: companySize || undefined,
          country: country.trim() || undefined,
          region: region.trim() || undefined,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create organization');
      
      setCreatedOrg(data.organization);
      setSuccess(data.message);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Send OTP for Admin Account
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    resetFieldErrors();
    setLoading(true);
    
    try {
      const errors: Record<string, string> = {};
      const nameError = validateName(adminName);
      if (nameError) errors.adminName = nameError;
      
      const emailError = validateEmail(adminEmail);
      if (emailError) errors.adminEmail = emailError;
      
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      const res = await fetch(apiUrl('/auth/signup/send-admin-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: createdOrg.id,
          name: adminName.trim(),
          email: adminEmail.trim(),
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send verification code');
      
      // Store organization data from response
      if (data.organization) {
        setCreatedOrg(data.organization);
      }
      
      setSuccess(data.message);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify OTP and Create Admin
  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    resetFieldErrors();
    setLoading(true);
    
    try {
      const errors: Record<string, string> = {};
      
      const otpError = validateOtp(otpCode);
      if (otpError) errors.otp = otpError;
      
      const passwordError = validatePassword(adminPassword);
      if (passwordError) errors.password = passwordError;
      
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      const res = await fetch(apiUrl('/auth/signup/verify-admin-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.trim(),
          code: otpCode.trim(),
          password: adminPassword,
          organizationId: createdOrg?.id,
          name: adminName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create administrator');
      }
      
      // Store token and user data
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      setSuccess(data.message);
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    resetError();
    resetFieldErrors();
    setResendLoading(true);
    setResendMessage('');
    
    try {
      const res = await fetch(apiUrl('/auth/signup/send-admin-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: createdOrg.id,
          name: adminName.trim(),
          email: adminEmail.trim(),
        }),
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

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Create Your Organization</h1>
            <p className="text-slate-600">
              {step === 1 ? 'Start by setting up your organization' : 
               step === 2 ? 'Create your administrator account' : 
               'Verify your email address'}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              1
            </div>
            <div className={`w-16 h-1 mx-2 ${
              step >= 2 ? 'bg-blue-600' : 'bg-slate-200'
            }`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              2
            </div>
            <div className={`w-16 h-1 mx-2 ${
              step >= 3 ? 'bg-blue-600' : 'bg-slate-200'
            }`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              3
            </div>
          </div>

          {/* Step 1: Organization Details */}
          {step === 1 && (
            <>
              <form onSubmit={handleStep1}>
                {error && (
                  <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
                )}
                {success && (
                  <p className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">{success}</p>
                )}
                
                <label className={labelClass}>Organization Name *</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  className={`${inputClass + ' mb-4'} ${fieldErrors.orgName ? 'border-red-500' : ''}`}
                  placeholder="e.g. Acme Corporation"
                />
                {fieldErrors.orgName && (
                  <p className="text-red-500 text-sm mb-4">{fieldErrors.orgName}</p>
                )}

                <label className={labelClass}>Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className={inputClass + ' mb-4'}
                >
                  <option value="">Select Industry</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind.value} value={ind.value}>{ind.label}</option>
                  ))}
                </select>

                <label className={labelClass}>Company Size</label>
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  className={inputClass + ' mb-4'}
                >
                  <option value="">Select Size</option>
                  {COMPANY_SIZES.map((size) => (
                    <option key={size.value} value={size.value}>{size.label}</option>
                  ))}
                </select>

                <label className={labelClass}>Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={inputClass + ' mb-4'}
                  placeholder="e.g. United States"
                />

                <label className={labelClass}>Region/State</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className={inputClass + ' mb-6'}
                  placeholder="e.g. California"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className={`${buttonClass} bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? 'Creating Organization...' : 'Continue'}
                </button>
              </form>
            </>
          )}

          {/* Step 2: Admin Details */}
          {step === 2 && (
            <>
              <form onSubmit={handleStep2}>
                {error && (
                  <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
                )}
                {success && (
                  <p className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">{success}</p>
                )}

                {/* Organization Summary */}
                {createdOrg && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-1">Organization: {createdOrg.name}</p>
                    <p className="text-xs text-blue-700">ID: {createdOrg.orgId}</p>
                  </div>
                )}

                <label className={labelClass}>Your Name *</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  className={`${inputClass + ' mb-4'} ${fieldErrors.adminName ? 'border-red-500' : ''}`}
                  placeholder="e.g. John Doe"
                />
                {fieldErrors.adminName && (
                  <p className="text-red-500 text-sm mb-4">{fieldErrors.adminName}</p>
                )}

                <label className={labelClass}>Email Address *</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  className={`${inputClass + ' mb-6'} ${fieldErrors.adminEmail ? 'border-red-500' : ''}`}
                  placeholder="you@company.com"
                />
                {fieldErrors.adminEmail && (
                  <p className="text-red-500 text-sm mb-6">{fieldErrors.adminEmail}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`${buttonClass} bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? 'Sending Verification Code...' : 'Send Verification Code'}
                </button>
              </form>
            </>
          )}

          {/* Step 3: OTP Verification */}
          {step === 3 && (
            <>
              <form onSubmit={handleStep3}>
                {error && (
                  <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
                )}
                {success && (
                  <p className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">{success}</p>
                )}

                {/* Organization Summary */}
                {createdOrg && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-1">Organization: {createdOrg.name}</p>
                    <p className="text-xs text-blue-700">ID: {createdOrg.orgId}</p>
                    <p className="text-xs text-blue-700 mt-1">Admin: {adminName} ({adminEmail})</p>
                  </div>
                )}

                <label className={labelClass}>Verification Code *</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  className={`${inputClass + ' mb-4 text-center text-lg tracking-widest'} ${fieldErrors.otp ? 'border-red-500' : ''}`}
                  placeholder="000000"
                />
                {fieldErrors.otp && (
                  <p className="text-red-500 text-sm mb-4">{fieldErrors.otp}</p>
                )}

                <label className={labelClass}>Set Password *</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                  className={`${inputClass + ' mb-2'} ${fieldErrors.password ? 'border-red-500' : ''}`}
                  placeholder="Min 8 chars: uppercase, lowercase, numbers, symbols"
                />
                {fieldErrors.password && (
                  <p className="text-red-500 text-sm mb-2">{fieldErrors.password}</p>
                )}

                {/* Password Strength Meter */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600">Password Strength</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength.score >= 3 ? 'text-green-600' : 
                      passwordStrength.score >= 2 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {passwordStrength.score >= 3 ? 'Strong' : 
                       passwordStrength.score >= 2 ? 'Medium' : 'Weak'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        passwordStrength.score >= 3 ? 'bg-green-500' : 
                        passwordStrength.score >= 2 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="mb-4 text-center">
                  <p className="text-sm text-slate-600 mb-2">
                    We sent a 6-digit code to <strong>{adminEmail}</strong>. 
                    Check your inbox (and spam). 
                  </p>
                  <p className="text-xs text-slate-500">
                    In development you can use <strong>123456</strong>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`${buttonClass} bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed mb-3`}
                >
                  {loading ? 'Creating Account...' : 'Create Administrator Account'}
                </button>

                {/* Resend OTP */}
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-2">Didn't receive the code?</p>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendLoading}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                  >
                    {resendLoading ? 'Sending...' : 'Resend Code'}
                  </button>
                  {resendMessage && (
                    <p className="text-xs text-green-600 mt-2">{resendMessage}</p>
                  )}
                </div>
              </form>
            </>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
