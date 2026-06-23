import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Organization, Department, Asset } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { env } from '../config/env.js';

const router = express.Router();

const TIER_LIMITS = {
  free: { assets: 50, users: 5 },
  pro: { assets: 200, users: 10 },
  premium: { assets: 1000, users: 20 },
};

const generateToken = (id) =>
  jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpire });

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

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
      .select('-passwordHash')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found' });

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
