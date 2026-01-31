import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canManageUsers, canViewAll } from '../services/permissions.js';

const router = express.Router();

router.use(protect);

const ROLES = ['super_admin', 'principal', 'hod', 'teacher', 'student', 'lab_technician', 'admin', 'manager', 'reporter'];

/** List users. Super admin / principal get full list with role, department, locations for Users & Roles page. */
router.get('/', async (req, res) => {
  try {
    const canListAll = canViewAll(req.user) || canManageUsers(req.user);
    if (!canListAll) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const { departmentId } = req.query;
    let filter = { isActive: true };
    
    // Apply department filter if provided and user has department
    if (departmentId) {
      filter.departmentId = departmentId;
    } else if (req.user.departmentId) {
      // If no department filter but user has department, default to user's department
      // This ensures HODs see users from their department by default
      filter.departmentId = req.user.departmentId;
    }
    // If no department filter and user has no department, keep all departments (no filter)
    
    const users = await User.find(filter)
      .select('_id name email role departmentId assignedLocationIds')
      .populate('departmentId', 'name')
      .populate('assignedLocationIds', 'name type code')
      .sort({ name: 1 })
      .lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Create user (super admin only). Add users by school/college email. */
router.post('/', async (req, res) => {
  try {
    if (!canManageUsers(req.user)) {
      return res.status(403).json({ message: 'Only super admin can add users' });
    }
    const { email, name, role, password, departmentId, assignedLocationIds } = req.body;
    if (!email || !name || !role || !password) {
      return res.status(400).json({ message: 'Email, name, role and password are required' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: `Role must be one of: ${ROLES.join(', ')}` });
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
      name: name.trim(),
      role,
      organizationId: req.user.organizationId,
      departmentId: departmentId || undefined,
      assignedLocationIds: Array.isArray(assignedLocationIds) ? assignedLocationIds : undefined,
      emailVerified: true,
    });
    const populated = await User.findById(user._id)
      .select('_id name email role departmentId assignedLocationIds')
      .populate('departmentId', 'name')
      .populate('assignedLocationIds', 'name type code')
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Update user (super admin only). */
router.patch('/:id', async (req, res) => {
  try {
    if (!canManageUsers(req.user)) {
      return res.status(403).json({ message: 'Only super admin can update users' });
    }
    const { name, role, departmentId, assignedLocationIds, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (role !== undefined) {
      if (!ROLES.includes(role)) {
        return res.status(400).json({ message: `Role must be one of: ${ROLES.join(', ')}` });
      }
      update.role = role;
    }
    if (departmentId !== undefined) update.departmentId = departmentId || null;
    if (assignedLocationIds !== undefined) update.assignedLocationIds = Array.isArray(assignedLocationIds) ? assignedLocationIds : [];
    if (isActive !== undefined) update.isActive = !!isActive;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('_id name email role departmentId assignedLocationIds isActive')
      .populate('departmentId', 'name')
      .populate('assignedLocationIds', 'name type code')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
