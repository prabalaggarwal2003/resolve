import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { env } from '../config/env.js';

const router = express.Router();

const generateToken = (id) =>
  jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpire });

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, departmentId, phone } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password and name required' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      name,
      role: role || 'reporter',
      departmentId: departmentId || undefined,
      phone,
    });
    const token = generateToken(user._id);
    res.status(201).json({
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    await User.updateOne({ _id: user._id }, { lastLogin: new Date() });
    const token = generateToken(user._id);
    res.json({
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('organizationId', 'name industry companySize country primaryGoal estimatedAssets')
    .select('-passwordHash')
    .lean();
  res.json({ user });
});

export default router;
