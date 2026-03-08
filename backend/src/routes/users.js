import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canManageUsers, canViewAll } from '../services/permissions.js';

const router = express.Router();
router.use(protect);

// Core 3 roles only
const ROLES = ['super_admin', 'admin', 'manager'];

/** List users — super_admin sees all in org, others forbidden */
router.get('/', async (req, res) => {
  try {
    if (!canManageUsers(req.user) && !canViewAll(req.user)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const filter = { isActive: true, organizationId: req.user.organizationId };
    const users = await User.find(filter)
      .select('_id name email role departmentId assignedLocationIds isActive organizationId')
      .populate('departmentId', 'name')
      .populate('assignedLocationIds', 'name type code')
      .sort({ name: 1 })
      .lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Create user — super_admin only */
router.post('/', async (req, res) => {
  try {
    if (!canManageUsers(req.user)) {
      return res.status(403).json({ message: 'Only Super Admin can add users' });
    }
    const { email, name, role, password, departmentId, assignedLocationIds } = req.body;
    if (!email || !name || !role || !password)
      return res.status(400).json({ message: 'Email, name, role and password are required' });
    if (!ROLES.includes(role))
      return res.status(400).json({ message: `Role must be one of: ${ROLES.join(', ')}` });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name: name.trim(),
      role,
      organizationId: req.user.organizationId, // always inherit from creator
      departmentId: departmentId || undefined,
      assignedLocationIds: Array.isArray(assignedLocationIds) ? assignedLocationIds : undefined,
      emailVerified: true,
    });
    const populated = await User.findById(user._id)
      .select('_id name email role departmentId assignedLocationIds isActive organizationId')
      .populate('departmentId', 'name')
      .populate('assignedLocationIds', 'name type code')
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Update user — super_admin only */
router.patch('/:id', async (req, res) => {
  try {
    if (!canManageUsers(req.user)) {
      return res.status(403).json({ message: 'Only Super Admin can update users' });
    }
    const { name, role, departmentId, assignedLocationIds, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (role !== undefined) {
      if (!ROLES.includes(role)) return res.status(400).json({ message: `Role must be one of: ${ROLES.join(', ')}` });
      update.role = role;
    }
    if (departmentId !== undefined) update.departmentId = departmentId || null;
    if (assignedLocationIds !== undefined) update.assignedLocationIds = Array.isArray(assignedLocationIds) ? assignedLocationIds : [];
    if (isActive !== undefined) update.isActive = !!isActive;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('_id name email role departmentId assignedLocationIds isActive organizationId')
      .populate('departmentId', 'name')
      .populate('assignedLocationIds', 'name type code')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Delete user — super_admin only */
router.delete('/:id', async (req, res) => {
  try {
    if (!canManageUsers(req.user)) {
      return res.status(403).json({ message: 'Only Super Admin can delete users' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Prevent self-deletion
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    // Enforce org boundary
    if (user.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
