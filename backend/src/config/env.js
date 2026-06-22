import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'https://resolve-ten.vercel.app',
  // Brevo (transactional email for OTP)
  brevoApiKey: process.env.BREVO_API_KEY,
  brevoFromEmail: process.env.BREVO_FROM_EMAIL || 'resolveishere@gmail.com',
  brevoFromName: process.env.BREVO_FROM_NAME || 'Resolve',
};
