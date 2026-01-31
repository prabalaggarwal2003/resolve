import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * OTP sending: if SMTP env vars are set, send email; otherwise log to console.
 * In development, code 123456 is accepted as bypass when NODE_ENV=development.
 */

export function getDevBypassCode() {
  return process.env.NODE_ENV === 'development' ? '123456' : null;
}

export function isDevBypass(code) {
  const bypass = getDevBypassCode();
  return bypass && code === bypass;
}

export async function sendOtpEmail(email, code) {
  try {
    console.log(`[OTP] Attempting to send email to ${email}`);
    console.log(`[OTP] SMTP Config: host=${env.smtpHost}, port=${env.smtpPort}, user=${env.smtpUser}`);
    
    const transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: parseInt(env.smtpPort || '465'),
      secure: env.smtpPort === '465' ? true : (env.smtpSecure === 'true'),
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
      timeout: 15000, // 15 second timeout
      debug: true, // Enable debug logging
    });

    const mailOptions = {
      from: `"${env.smtpFromName || 'Resolve'}" <${env.smtpFromEmail || env.smtpUser}>`,
      to: email,
      subject: 'Verify your Resolve account',
      html: `<h2>Verification Code: ${code}</h2><p>This code expires in 10 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[OTP] Email sent successfully to ${email}`);
    return true;
  } catch (err) {
    console.error(`[OTP] SMTP Error:`, err.message);
    console.error(`[OTP] Full Error:`, err);
    console.log(`[OTP] ${email} → ${code} (valid 10 min) - FALLBACK`);
    return true;
  }
}
