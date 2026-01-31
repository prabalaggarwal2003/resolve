import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Organization, Otp } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { sendOtpEmail, isDevBypass } from '../services/otpService.js';
import { validateEmail, validatePassword, validateName, validateOtp, sanitizeInput } from '../utils/validation.js';

const router = express.Router();
const generateToken = (id) => jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpire });

function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Step 1: Account basics (name, email, password) → send OTP
router.post('/account', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validate inputs
    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ message: nameError });
    
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });
    
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });
    
    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = email.toLowerCase().trim();
    
    const existing = await User.findOne({ email: sanitizedEmail });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    const passwordHash = await bcrypt.hash(password, 12); // Increased rounds for security
    const user = await User.create({
      email: sanitizedEmail,
      passwordHash,
      name: sanitizedName,
      role: 'super_admin',
      emailVerified: false,
    });
    
    const code = randomOtp();
    await Otp.create({
      email: user.email,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });
    
    await sendOtpEmail(user.email, code);
    res.status(201).json({
      needOtp: true,
      email: user.email,
      message: 'Verification code sent to your email',
    });
  } catch (err) {
    console.error('Signup account error:', err);
    res.status(500).json({ message: 'Failed to create account. Please try again.' });
  }
});

// Step 2: Verify OTP → return token
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    // Validate inputs
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });
    
    const otpError = validateOtp(code);
    if (otpError) return res.status(400).json({ message: otpError });
    
    const sanitizedEmail = email.toLowerCase().trim();
    
    if (isDevBypass(code)) {
      const user = await User.findOneAndUpdate(
        { email: sanitizedEmail },
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
      email: sanitizedEmail,
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
    console.error('OTP verification error:', err);
    res.status(500).json({ message: 'Failed to verify code. Please try again.' });
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
