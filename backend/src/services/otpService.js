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
  // Optional: add nodemailer and use SMTP from env (SMTP_HOST, SMTP_USER, SMTP_PASS, etc.)
  // For now, log so dev can use the code (or use 123456 in dev)
  console.log(`[OTP] ${email} → ${code} (valid 10 min)`);
  return true;
}
