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

function buildOtpEmailHtml(code, { title, description }) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #e5e7eb; background: #111827; border-radius: 16px;">
      <h1 style="margin: 0 0 8px; font-size: 22px; color: #f9fafb;">${title}</h1>
      <p style="margin: 0 0 24px; font-size: 14px; color: #9ca3af;">${description}</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 0.35em; text-align: center; padding: 20px; background: #1f2937; border: 1px solid #374151; border-radius: 12px; color: #f9fafb;">${code}</div>
      <p style="margin: 24px 0 0; font-size: 12px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

/**
 * Send OTP email via Brevo.
 * In non-production, falls back to console logging if Brevo is missing or fails,
 * so local/report testing is not blocked.
 * @returns {{ delivered: boolean, devFallback?: boolean }}
 */
async function sendOtpEmailWithContent(email, code, { subject, title, description, textPrefix }) {
  const allowDevFallback = env.nodeEnv !== 'production';

  const sendViaBrevo = async () => {
    if (!env.brevoApiKey) {
      const err = new Error('Email service is not configured (BREVO_API_KEY)');
      err.code = 'BREVO_NOT_CONFIGURED';
      throw err;
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
        subject,
        htmlContent: buildOtpEmailHtml(code, { title, description }),
        textContent: `${textPrefix} ${code}. It expires in 10 minutes.`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[OTP] Brevo API error:', response.status, body);
      const err = new Error('Failed to send verification email');
      err.code = 'BREVO_SEND_FAILED';
      err.details = body;
      throw err;
    }

    console.log(`[OTP] Email sent to ${email}: ${subject}`);
    return { delivered: true };
  };

  try {
    return await sendViaBrevo();
  } catch (err) {
    if (allowDevFallback) {
      console.warn(
        `[OTP] Email not delivered (${err.message}). Dev fallback — code for ${email}: ${code}`
      );
      return { delivered: false, devFallback: true };
    }
    throw err;
  }
}

export async function sendOtpEmail(email, code) {
  return sendOtpEmailWithContent(email, code, {
    subject: 'Your Resolve verification code',
    title: 'Verify your Resolve account',
    description: 'Use this code to complete your organisation signup. It expires in 10 minutes.',
    textPrefix: 'Your Resolve verification code is',
  });
}

export async function sendPasswordResetOtpEmail(email, code) {
  return sendOtpEmailWithContent(email, code, {
    subject: 'Reset your Resolve password',
    title: 'Reset your password',
    description: 'Use this code to reset your Resolve password. It expires in 10 minutes.',
    textPrefix: 'Your Resolve password reset code is',
  });
}

export async function sendPublicReportOtpEmail(email, code) {
  return sendOtpEmailWithContent(email, code, {
    subject: 'Your Resolve report verification code',
    title: 'Verify your email to report an issue',
    description: 'Use this code to verify your email before submitting a report. It expires in 10 minutes.',
    textPrefix: 'Your Resolve report verification code is',
  });
}
