import express from 'express';
import jwt from 'jsonwebtoken';
import { User, Department } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { env } from '../config/env.js';
import {
  buildSetupPayload,
  checkRateLimit,
  clearRateLimit,
  encryptSecret,
  generateBackupCodes,
  generateTotpSecret,
  getDecryptedTotpSecret,
  recordFailedAttempt,
  verifyAndConsumeBackupCode,
  verifyTotpCode,
} from '../services/twoFactorService.js';
import {
  logRecoveryCodesRegenerated,
  logTwoFactorDisabled,
  logTwoFactorEnabled,
} from '../services/profileLogService.js';

const router = express.Router();

const generateToken = (id) =>
  jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpire });

const generatePreAuthToken = (id) =>
  jwt.sign({ id, purpose: '2fa_login' }, env.jwtSecret, { expiresIn: '5m' });

async function buildLoginResponse(userId) {
  const user = await User.findById(userId).select('-passwordHash').lean();
  if (!user) return null;

  let departmentName = null;
  if (user.departmentId) {
    const dept = await Department.findById(user.departmentId).select('name').lean();
    departmentName = dept?.name ?? null;
  }

  await User.updateOne({ _id: userId }, { lastLogin: new Date() });

  return {
    token: generateToken(userId),
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      departmentId: user.departmentId ?? null,
      departmentName,
    },
  };
}

function resolvePreAuthUser(preAuthToken, email) {
  if (preAuthToken) {
    try {
      const decoded = jwt.verify(preAuthToken, env.jwtSecret);
      if (decoded.purpose !== '2fa_login' || !decoded.id) {
        return { error: 'Invalid login session. Sign in again.' };
      }
      return { userId: decoded.id };
    } catch {
      return { error: 'Login session expired. Sign in again.' };
    }
  }

  if (!email) {
    return { error: 'Email or login session required' };
  }

  return { email: email.toLowerCase().trim() };
}

async function loadUserFor2faLogin({ userId, email }) {
  if (userId) {
    return User.findById(userId).select('+twoFactorSecret +backupCodes');
  }
  return User.findOne({ email }).select('+twoFactorSecret +backupCodes');
}

router.post('/setup', protect, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required to enable 2FA' });
    }

    const user = await User.findById(req.user._id).select('+passwordHash +twoFactorSecret');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is already enabled' });
    }

    const matches = await user.matchPassword(password);
    if (!matches) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const secret = generateTotpSecret(user.email);
    user.twoFactorSecret = encryptSecret(secret.base32);
    user.twoFactorEnabled = false;
    user.backupCodes = [];
    await user.save();

    const setup = await buildSetupPayload(secret, user.email);

    res.json({
      message: 'Scan the QR code with your authenticator app',
      qrCode: setup.qrCode,
      manualKey: setup.manualKey,
    });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ message: err.message || 'Failed to set up 2FA' });
  }
});

router.post('/verify', protect, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Authenticator code is required' });
    }

    const rateLimitError = checkRateLimit(req.user._id);
    if (rateLimitError) return res.status(429).json({ message: rateLimitError });

    const user = await User.findById(req.user._id).select('+twoFactorSecret +backupCodes');
    if (!user?.twoFactorSecret) {
      return res.status(400).json({ message: 'Start 2FA setup first' });
    }

    const secret = getDecryptedTotpSecret(user);
    const valid = verifyTotpCode(secret, code);
    if (!valid) {
      recordFailedAttempt(req.user._id);
      return res.status(401).json({ message: 'Invalid authenticator code' });
    }

    clearRateLimit(req.user._id);

    const { plainCodes, hashedCodes } = await generateBackupCodes();
    user.twoFactorEnabled = true;
    user.backupCodes = hashedCodes;
    await user.save();

    await logTwoFactorEnabled(req.user._id, req, user);

    res.json({
      message: 'Two-factor authentication enabled',
      recoveryCodes: plainCodes,
    });
  } catch (err) {
    console.error('2FA verify error:', err);
    res.status(500).json({ message: err.message || 'Failed to enable 2FA' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, code, preAuthToken } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Authenticator code is required' });
    }

    const resolved = resolvePreAuthUser(preAuthToken, email);
    if (resolved.error) return res.status(400).json({ message: resolved.error });

    const identifier = resolved.userId || resolved.email;
    const rateLimitError = checkRateLimit(identifier);
    if (rateLimitError) return res.status(429).json({ message: rateLimitError });

    const user = await loadUserFor2faLogin(resolved);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled for this account' });
    }

    const secret = getDecryptedTotpSecret(user);
    const valid = verifyTotpCode(secret, code);
    if (!valid) {
      recordFailedAttempt(identifier);
      return res.status(401).json({ message: 'Invalid authenticator code' });
    }

    clearRateLimit(identifier);

    const payload = await buildLoginResponse(user._id);
    if (!payload) return res.status(404).json({ message: 'User not found' });

    res.json(payload);
  } catch (err) {
    console.error('2FA login error:', err);
    res.status(500).json({ message: err.message || 'Login verification failed' });
  }
});

router.post('/recovery', async (req, res) => {
  try {
    const { email, recoveryCode, preAuthToken } = req.body;
    if (!recoveryCode) {
      return res.status(400).json({ message: 'Recovery code is required' });
    }

    const resolved = resolvePreAuthUser(preAuthToken, email);
    if (resolved.error) return res.status(400).json({ message: resolved.error });

    const identifier = resolved.userId || resolved.email;
    const rateLimitError = checkRateLimit(identifier);
    if (rateLimitError) return res.status(429).json({ message: rateLimitError });

    const user = await loadUserFor2faLogin(resolved);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled for this account' });
    }

    const valid = await verifyAndConsumeBackupCode(user, recoveryCode);
    if (!valid) {
      recordFailedAttempt(identifier);
      return res.status(401).json({ message: 'Invalid recovery code' });
    }

    clearRateLimit(identifier);

    const payload = await buildLoginResponse(user._id);
    if (!payload) return res.status(404).json({ message: 'User not found' });

    res.json(payload);
  } catch (err) {
    console.error('2FA recovery error:', err);
    res.status(500).json({ message: err.message || 'Recovery login failed' });
  }
});

router.post('/disable', protect, async (req, res) => {
  try {
    const { password, code } = req.body;
    if (!password || !code) {
      return res.status(400).json({ message: 'Password and authenticator code are required' });
    }

    const rateLimitError = checkRateLimit(req.user._id);
    if (rateLimitError) return res.status(429).json({ message: rateLimitError });

    const user = await User.findById(req.user._id).select('+passwordHash +twoFactorSecret +backupCodes');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
    }

    const matches = await user.matchPassword(password);
    if (!matches) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const secret = getDecryptedTotpSecret(user);
    const valid = verifyTotpCode(secret, code);
    if (!valid) {
      recordFailedAttempt(req.user._id);
      return res.status(401).json({ message: 'Invalid authenticator code' });
    }

    clearRateLimit(req.user._id);

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.backupCodes = [];
    await user.save();

    await logTwoFactorDisabled(req.user._id, req, user);

    res.json({ message: 'Two-factor authentication disabled' });
  } catch (err) {
    console.error('2FA disable error:', err);
    res.status(500).json({ message: err.message || 'Failed to disable 2FA' });
  }
});

router.post('/regenerate-recovery', protect, async (req, res) => {
  try {
    const { password, code } = req.body;
    if (!password || !code) {
      return res.status(400).json({ message: 'Password and authenticator code are required' });
    }

    const user = await User.findById(req.user._id).select('+passwordHash +twoFactorSecret +backupCodes');
    if (!user?.twoFactorEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
    }

    const matches = await user.matchPassword(password);
    if (!matches) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const secret = getDecryptedTotpSecret(user);
    const valid = verifyTotpCode(secret, code);
    if (!valid) {
      recordFailedAttempt(req.user._id);
      return res.status(401).json({ message: 'Invalid authenticator code' });
    }

    const { plainCodes, hashedCodes } = await generateBackupCodes();
    user.backupCodes = hashedCodes;
    await user.save();

    await logRecoveryCodesRegenerated(req.user._id, req, user);

    res.json({
      message: 'Recovery codes regenerated',
      recoveryCodes: plainCodes,
    });
  } catch (err) {
    console.error('2FA regenerate recovery error:', err);
    res.status(500).json({ message: err.message || 'Failed to regenerate recovery codes' });
  }
});

export { generatePreAuthToken, buildLoginResponse };
export default router;
