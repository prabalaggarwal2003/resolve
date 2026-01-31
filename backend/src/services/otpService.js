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

// SendGrid API fallback (more reliable than SMTP)
async function sendViaSendGridAPI(email, code) {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.smtpPass}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email }],
          subject: 'Verify your Resolve account',
        }],
        from: { email: env.smtpFromEmail, name: env.smtpFromName || 'Resolve' },
        content: [{
          type: 'text/html',
          value: `<h2>Verification Code: ${code}</h2><p>This code expires in 10 minutes.</p>`,
        }],
      }),
    });

    if (response.ok) {
      console.log(`[OTP] Email sent via SendGrid API to ${email}`);
      return true;
    } else {
      throw new Error(`SendGrid API error: ${response.status}`);
    }
  } catch (err) {
    console.error(`[OTP] SendGrid API Error:`, err.message);
    return false;
  }
}

export async function sendOtpEmail(email, code) {
  try {
    console.log(`[OTP] Attempting to send email to ${email}`);
    console.log(`[OTP] SMTP Config: host=${env.smtpHost}, port=${env.smtpPort}, user=${env.smtpUser}`);
    
    // Try SendGrid API first (more reliable)
    if (env.smtpHost === 'smtp.sendgrid.net' && env.smtpPass?.startsWith('SG.')) {
      const apiSuccess = await sendViaSendGridAPI(email, code);
      if (apiSuccess) return true;
      console.log(`[OTP] API failed, trying SMTP fallback...`);
    }
    
    // SMTP fallback
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
