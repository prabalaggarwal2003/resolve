import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Organization, Department, Asset, Otp } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { env } from '../config/env.js';
import {
  sendPasswordResetOtpEmail,
  generateOtp,
  hashOtp,
  verifyOtpHash,
  getOtpExpiry,
} from '../services/otpService.js';
import { validateEmail, validatePassword, validateOtp } from '../utils/validation.js';
import { deleteOrganizationCascade } from '../services/organizationDeleteService.js';
import {
  buildProfileEditChanges,
  logPasswordChanged,
  logProfileUpdated,
} from '../services/profileLogService.js';
import twoFactorRouter, { generatePreAuthToken } from './twoFactor.js';

const router = express.Router();

router.use('/2fa', twoFactorRouter);

const TIER_LIMITS = {
  free: { assets: 50, users: 5 },
  pro: { assets: 200, users: 10 },
  premium: { assets: 1000, users: 20 },
};

const generateToken = (id) =>
  jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpire });

const generateResetToken = (email) =>
  jwt.sign({ email, purpose: 'password_reset' }, env.jwtSecret, { expiresIn: '15m' });

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });

    const sanitizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email' });
    }
    if (!user.isActive) {
      return res.status(400).json({ message: 'Account is inactive. Contact your administrator.' });
    }

    await Otp.deleteMany({ email: sanitizedEmail, purpose: 'password_reset' });

    const code = generateOtp();
    const codeHash = await hashOtp(code);

    const otpRecord = await Otp.create({
      email: sanitizedEmail,
      purpose: 'password_reset',
      codeHash,
      expiresAt: getOtpExpiry(),
    });

    try {
      await sendPasswordResetOtpEmail(sanitizedEmail, code);
    } catch (sendErr) {
      await Otp.deleteOne({ _id: otpRecord._id });
      throw sendErr;
    }

    res.json({ message: 'Verification code sent to your email', email: sanitizedEmail });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: err.message || 'Failed to send verification code' });
  }
});

router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });
    const otpError = validateOtp(code);
    if (otpError) return res.status(400).json({ message: otpError });

    const sanitizedEmail = email.toLowerCase().trim();
    const otp = await Otp.findOne({
      email: sanitizedEmail,
      purpose: 'password_reset',
    }).sort({ createdAt: -1 });

    if (!otp) return res.status(400).json({ message: 'Invalid or expired code' });
    if (new Date() > otp.expiresAt) {
      await Otp.deleteOne({ _id: otp._id });
      return res.status(400).json({ message: 'Code has expired. Request a new one.' });
    }

    const codeValid = await verifyOtpHash(code, otp.codeHash);
    if (!codeValid) return res.status(400).json({ message: 'Invalid verification code' });

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user || !user.isActive) {
      return res.status(400).json({ message: 'Account not found or inactive' });
    }

    await Otp.deleteOne({ _id: otp._id });
    const resetToken = generateResetToken(sanitizedEmail);

    res.json({ message: 'Code verified', resetToken });
  } catch (err) {
    console.error('Verify reset OTP error:', err);
    res.status(500).json({ message: err.message || 'Verification failed' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, password } = req.body;
    if (!resetToken) return res.status(400).json({ message: 'Reset token required' });

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    let decoded;
    try {
      decoded = jwt.verify(resetToken, env.jwtSecret);
    } catch {
      return res.status(400).json({ message: 'Reset link expired. Start again from forgot password.' });
    }

    if (decoded.purpose !== 'password_reset' || !decoded.email) {
      return res.status(400).json({ message: 'Invalid reset token' });
    }

    const user = await User.findOne({ email: decoded.email }).select('+passwordHash');
    if (!user || !user.isActive) {
      return res.status(400).json({ message: 'Account not found or inactive' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    user.passwordHash = passwordHash;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: err.message || 'Failed to reset password' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user.isActive) return res.status(401).json({ message: 'Account inactive' });

    if (user.twoFactorEnabled) {
      const preAuthToken = generatePreAuthToken(user._id);
      return res.json({
        requiresTwoFactor: true,
        preAuthToken,
        email: user.email,
      });
    }

    await User.updateOne({ _id: user._id }, { lastLogin: new Date() });
    const token = generateToken(user._id);

    // Fetch department name if user has one
    let departmentName = null;
    if (user.departmentId) {
      const dept = await Department.findById(user.departmentId).select('name').lean();
      departmentName = dept?.name ?? null;
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        departmentId: user.departmentId ?? null,
        departmentName,
      },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-passwordHash')
    .lean();
  
  // Only populate organizationId if user actually has one
  if (user.organizationId) {
    user.organizationId = await Organization.findById(user.organizationId)
      .select('name industry companySize country primaryGoal estimatedAssets')
      .lean();
  }
  
  res.json({ user });
});

router.get('/profile', protect, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.user._id).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const org = user.organizationId
      ? await Organization.findById(user.organizationId).lean()
      : null;

    const now = new Date();
    const isExpired = org?.subscriptionEndDate && org.subscriptionEndDate < now;
    const tier = isExpired ? 'free' : org?.subscriptionTier || 'free';
    const limits = TIER_LIMITS[tier];

    const [assetCount, userCount, orgOwner] = await Promise.all([
      Asset.countDocuments({ organizationId: user.organizationId }),
      User.countDocuments({ organizationId: user.organizationId, isActive: true }),
      User.findOne({ organizationId: user.organizationId, role: 'super_admin' })
        .sort({ createdAt: 1 })
        .select('_id')
        .lean(),
    ]);

    res.json({
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        jobTitle: user.jobTitle || '',
        timeZone: user.timeZone || 'Asia/Kolkata',
        role: user.role,
        memberSince: user.createdAt,
        lastLogin: user.lastLogin,
        organizationName: org?.name || '',
        isOrgOwner: orgOwner?._id?.toString() === user._id.toString(),
        subscription: {
          tier,
          plan: org?.subscriptionPlan || 'monthly',
          isExpired: Boolean(isExpired),
          subscriptionStartDate: org?.subscriptionStartDate,
          subscriptionEndDate: org?.subscriptionEndDate,
          limits,
        },
        usage: {
          assets: assetCount,
          users: userCount,
        },
        emailVerified: Boolean(user.emailVerified),
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/profile', protect, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, phone, jobTitle, timeZone } = req.body;
    const updates = {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ message: 'Name is required' });
      updates.name = trimmed;
    }
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (jobTitle !== undefined) updates.jobTitle = String(jobTitle).trim();
    if (timeZone !== undefined) updates.timeZone = String(timeZone).trim() || 'Asia/Kolkata';

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    const prev = await User.findById(req.user._id).select('-passwordHash').lean();
    if (!prev) return res.status(404).json({ message: 'User not found' });

    const pendingEditLog = buildProfileEditChanges(prev, updates);

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
      .select('-passwordHash')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found' });

    if (pendingEditLog) {
      await logProfileUpdated(req.user._id, req, user, pendingEditLog);
    }

    const storedUser = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      departmentId: user.departmentId ?? null,
    };

    res.json({
      message: 'Profile updated',
      user: storedUser,
      profile: {
        name: user.name,
        phone: user.phone || '',
        jobTitle: user.jobTitle || '',
        timeZone: user.timeZone || 'Asia/Kolkata',
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/change-password', protect, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const matches = await user.matchPassword(currentPassword);
    if (!matches) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logPasswordChanged(req.user._id, req, user);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/account', protect, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete your account' });
    }

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const matches = await user.matchPassword(password);
    if (!matches) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    if (!user.organizationId) {
      await User.findByIdAndDelete(user._id);
      return res.json({ message: 'Account deleted successfully' });
    }

    const orgOwner = await User.findOne({
      organizationId: user.organizationId,
      role: 'super_admin',
    })
      .sort({ createdAt: 1 })
      .select('_id')
      .lean();

    if (!orgOwner || orgOwner._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        message: 'Only the organization owner can delete the account and all organization data',
      });
    }

    await deleteOrganizationCascade(user.organizationId);

    res.json({ message: 'Account and organization deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ message: err.message || 'Failed to delete account' });
  }
});

router.post('/logout', protect, async (req, res) => {
  try {
    // In a real implementation, you might want to:
    // 1. Add the token to a blacklist
    // 2. Or use short-lived tokens with refresh tokens
    // For now, we'll just clear the client-side token
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Logout failed' });
  }
});

export default router;
