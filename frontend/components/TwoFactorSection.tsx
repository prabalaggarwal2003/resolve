'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/api';
import { validateOtp } from '@/lib/validation';

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';

type Props = {
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  token: string | null;
  onStatusChange: () => void;
};

type SetupStep = 'idle' | 'password' | 'scan' | 'recovery';

export default function TwoFactorSection({
  emailVerified,
  twoFactorEnabled,
  token,
  onStatusChange,
}: Props) {
  const [step, setStep] = useState<SetupStep>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenCode, setRegenCode] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || localStorage.getItem('token')}`,
  });

  const resetSetup = () => {
    setStep('idle');
    setSetupPassword('');
    setQrCode('');
    setManualKey('');
    setVerifyCode('');
    setRecoveryCodes([]);
    setError('');
  };

  const handleSetupStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/2fa/setup'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ password: setupPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start 2FA setup');

      setQrCode(data.qrCode);
      setManualKey(data.manualKey);
      setStep('scan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const otpError = validateOtp(verifyCode);
    if (otpError) {
      setError(otpError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/2fa/verify'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid code');

      setRecoveryCodes(data.recoveryCodes || []);
      setSuccess('Two-factor authentication enabled');
      setStep('recovery');
      onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/2fa/disable'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ password: disablePassword, code: disableCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to disable 2FA');

      setSuccess(data.message);
      setShowDisableForm(false);
      setDisablePassword('');
      setDisableCode('');
      onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/auth/2fa/regenerate-recovery'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ password: regenPassword, code: regenCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to regenerate codes');

      setRecoveryCodes(data.recoveryCodes || []);
      setStep('recovery');
      setShowRegenerateForm(false);
      setRegenPassword('');
      setRegenCode('');
      setSuccess(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate codes');
    } finally {
      setLoading(false);
    }
  };

  const copyRecoveryCodes = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setSuccess('Recovery codes copied to clipboard');
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
      <div>
        <p className={labelClass}>Email verification</p>
        <p className={`text-xs ${emailVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
          {emailVerified ? '✓ Verified' : 'Not verified'}
        </p>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className={labelClass}>Two-factor authentication</p>
          <span
            className={`text-[10px] px-2 py-0.5 rounded border uppercase ${
              twoFactorEnabled
                ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                : 'text-gray-400 bg-gray-500/15 border-gray-500/30'
            }`}
          >
            {twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {error && (
          <p className="text-[11px] text-red-400 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 mb-2">
            {error}
          </p>
        )}
        {success && step !== 'recovery' && (
          <p className="text-[11px] text-emerald-400 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 mb-2">
            {success}
          </p>
        )}

        {!twoFactorEnabled && step === 'idle' && (
          <button
            type="button"
            onClick={() => {
              setStep('password');
              setError('');
              setSuccess('');
            }}
            className={`${buttonClass} border-emerald-500/40 bg-emerald-600/15 text-emerald-200 hover:bg-emerald-600/25`}
          >
            Enable 2FA
          </button>
        )}

        {!twoFactorEnabled && step === 'password' && (
          <form onSubmit={handleSetupStart} className="space-y-3 max-w-sm">
            <p className="text-xs text-gray-500">Confirm your password to begin setup.</p>
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                required
                className={inputClass}
                autoComplete="current-password"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className={`${buttonClass} border-emerald-500/40 bg-emerald-600/20 text-emerald-200 disabled:opacity-50`}
              >
                {loading ? 'Starting…' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={resetSetup}
                className={`${buttonClass} border-gray-700/60 text-gray-400`}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!twoFactorEnabled && step === 'scan' && (
          <form onSubmit={handleVerifyEnable} className="space-y-3">
            <p className="text-xs text-gray-400">
              Scan this QR code with Google Authenticator, Microsoft Authenticator, Authy, Bitwarden,
              or 1Password.
            </p>
            {qrCode && (
              <div className="inline-block p-3 rounded-xl bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="2FA QR code" className="w-40 h-40" />
              </div>
            )}
            <div>
              <p className={labelClass}>Manual setup key</p>
              <code className="block text-xs text-gray-300 bg-gray-900/60 border border-gray-700/60 rounded-lg px-2.5 py-2 break-all">
                {manualKey}
              </code>
            </div>
            <div className="max-w-xs">
              <label className={labelClass}>Authenticator code</label>
              <input
                type="text"
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="000000"
                className={`${inputClass} text-center tracking-[0.4em]`}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className={`${buttonClass} border-emerald-500/40 bg-emerald-600/20 text-emerald-200 disabled:opacity-50`}
              >
                {loading ? 'Verifying…' : 'Verify & enable'}
              </button>
              <button type="button" onClick={resetSetup} className={`${buttonClass} border-gray-700/60 text-gray-400`}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {step === 'recovery' && recoveryCodes.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-amber-300/90">
              Save these recovery codes in a secure place. Each code can only be used once. They will not be shown again.
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-w-xs">
              {recoveryCodes.map((code) => (
                <code
                  key={code}
                  className="text-xs text-gray-200 bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-center"
                >
                  {code}
                </code>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyRecoveryCodes}
                className={`${buttonClass} border-gray-700/60 text-gray-300`}
              >
                Copy codes
              </button>
              <button
                type="button"
                onClick={() => {
                  resetSetup();
                  setSuccess('Recovery codes saved. Keep them secure.');
                }}
                className={`${buttonClass} border-emerald-500/40 bg-emerald-600/20 text-emerald-200`}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {twoFactorEnabled && step !== 'recovery' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Sign-in requires your authenticator app or a one-time recovery code.
            </p>
            <div className="flex flex-wrap gap-2">
              {!showDisableForm && !showRegenerateForm && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisableForm(true);
                      setShowRegenerateForm(false);
                      setError('');
                    }}
                    className={`${buttonClass} border-red-500/40 bg-red-600/15 text-red-300`}
                  >
                    Disable 2FA
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegenerateForm(true);
                      setShowDisableForm(false);
                      setError('');
                    }}
                    className={`${buttonClass} border-gray-700/60 text-gray-300`}
                  >
                    Regenerate recovery codes
                  </button>
                </>
              )}
            </div>

            {showDisableForm && (
              <form onSubmit={handleDisable} className="space-y-3 max-w-sm">
                <p className="text-xs text-gray-500">Enter your password and a current authenticator code.</p>
                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Authenticator code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`${buttonClass} border-red-500/40 bg-red-600/20 text-red-300 disabled:opacity-50`}
                  >
                    {loading ? 'Disabling…' : 'Confirm disable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDisableForm(false)}
                    className={`${buttonClass} border-gray-700/60 text-gray-400`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {showRegenerateForm && (
              <form onSubmit={handleRegenerate} className="space-y-3 max-w-sm">
                <p className="text-xs text-gray-500">This replaces all existing recovery codes.</p>
                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    type="password"
                    value={regenPassword}
                    onChange={(e) => setRegenPassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Authenticator code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={regenCode}
                    onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`${buttonClass} border-gray-700/60 text-gray-200 disabled:opacity-50`}
                  >
                    {loading ? 'Generating…' : 'Regenerate codes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRegenerateForm(false)}
                    className={`${buttonClass} border-gray-700/60 text-gray-400`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
