import nodemailer from 'nodemailer';

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
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Resolve" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify your Resolve account',
      html: `<h2>Verification Code: ${code}</h2><p>This code expires in 10 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[OTP] Email sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`[OTP] SMTP Error:`, err.message);
    console.log(`[OTP] ${email} → ${code} (valid 10 min) - FALLBACK`);
    return true;
  }
}
