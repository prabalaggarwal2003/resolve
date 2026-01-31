import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Organization, Otp } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { sendOtpEmail, isDevBypass } from '../services/otpService.js';

const router = express.Router();
const generateToken = (id) => jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpire });

function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Step 1: Account basics (name, email, password) → send OTP
router.post('/account', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role: 'super_admin',
      emailVerified: false,
    });
    const code = randomOtp();
    await Otp.create({
      email: user.email,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    await sendOtpEmail(user.email, code);
    res.status(201).json({
      needOtp: true,
      email: user.email,
      message: 'Verification code sent to your email',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Step 2: Verify OTP → return token
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code required' });
    }
    if (isDevBypass(code)) {
      const user = await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { emailVerified: true },
        { new: true }
      );
      if (!user) return res.status(400).json({ message: 'Account not found' });
      const token = generateToken(user._id);
      return res.json({
        token,
        user: { id: user._id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
      });
    }
    const otp = await Otp.findOne({
      email: email.toLowerCase(),
      code: String(code).trim(),
    });
    if (!otp) return res.status(400).json({ message: 'Invalid or expired code' });
    if (new Date() > otp.expiresAt) {
      await Otp.deleteOne({ _id: otp._id });
      return res.status(400).json({ message: 'Code expired' });
    }
    await User.updateOne({ email: otp.email }, { emailVerified: true });
    await Otp.deleteOne({ _id: otp._id });
    const user = await User.findOne({ email: otp.email }).lean();
    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Step 3: Organization profile (requires token from verify-otp)
router.post('/organization', protect, async (req, res) => {
  try {
    const { orgName, industry, companySize, country, region } = req.body;
    if (!orgName) {
      return res.status(400).json({ message: 'Organization name required' });
    }
    if (req.user.organizationId) {
      return res.status(400).json({ message: 'Organization already set' });
    }
    const org = await Organization.create({
      name: orgName,
      industry: industry || undefined,
      companySize: companySize || undefined,
      country: country || undefined,
      region: region || undefined,
    });
    await User.updateOne(
      { _id: req.user._id },
      { organizationId: org._id }
    );
    res.status(201).json({
      org: { id: org._id, name: org.name, industry: org.industry, companySize: org.companySize, country: org.country },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Step 4: Preferences (primary goal, estimated assets, optional invites)
router.post('/preferences', protect, async (req, res) => {
  try {
    const { primaryGoal, estimatedAssets, inviteEmails } = req.body;
    const user = await User.findById(req.user._id).populate('organizationId');
    if (!user?.organizationId) {
      return res.status(400).json({ message: 'Complete organization step first' });
    }
    await Organization.updateOne(
      { _id: user.organizationId._id },
      {
        primaryGoal: primaryGoal || undefined,
        estimatedAssets: estimatedAssets || undefined,
      }
    );
    // Optional: send invites to inviteEmails (array of emails) — placeholder for now
    if (inviteEmails && Array.isArray(inviteEmails) && inviteEmails.length > 0) {
      // TODO: create pending invites or send invitation emails
    }
    await User.updateOne({ _id: req.user._id }, { onboardingComplete: true });
    const org = await Organization.findById(user.organizationId._id).lean();
    res.json({
      done: true,
      orgName: org.name,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
