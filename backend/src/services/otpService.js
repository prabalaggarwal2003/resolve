import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export async function hashOtp(code) {
  return bcrypt.hash(String(code).trim(), BCRYPT_ROUNDS);
}

export async function verifyOtpHash(code, codeHash) {
  if (!code || !codeHash) return false;
  return bcrypt.compare(String(code).trim(), codeHash);
}

export function getOtpExpiry() {
  return new Date(Date.now() + OTP_EXPIRY_MS);
}

export function isDevBypass(code) {
  return env.nodeEnv === 'development' && code === '123456';
}

function buildOtpEmailHtml(code) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #e5e7eb; background: #111827; border-radius: 16px;">
      <h1 style="margin: 0 0 8px; font-size: 22px; color: #f9fafb;">Verify your Resolve account</h1>
      <p style="margin: 0 0 24px; font-size: 14px; color: #9ca3af;">Use this code to complete your organisation signup. It expires in 10 minutes.</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 0.35em; text-align: center; padding: 20px; background: #1f2937; border: 1px solid #374151; border-radius: 12px; color: #f9fafb;">${code}</div>
      <p style="margin: 24px 0 0; font-size: 12px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

export async function sendOtpEmail(email, code) {
  if (!env.brevoApiKey) {
    throw new Error('Brevo API key is not configured (BREVO_API_KEY)');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.brevoApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: env.brevoFromName,
        email: env.brevoFromEmail,
      },
      to: [{ email }],
      subject: 'Your Resolve verification code',
      htmlContent: buildOtpEmailHtml(code),
      textContent: `Your Resolve verification code is ${code}. It expires in 10 minutes.`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[OTP] Brevo API error:', response.status, body);
    throw new Error('Failed to send verification email');
  }

  console.log(`[OTP] Verification email sent to ${email}`);
}
