import express from 'express';
import { Department } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { canManageUsers } from '../services/permissions.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('locationId', 'name path type')
      .sort({ name: 1 })
      .lean();
    res.json({ departments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('locationId', 'name path type')
      .lean();
    if (!department) return res.status(404).json({ message: 'Department not found' });
    res.json(department);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', (req, res, next) => {
  if (!canManageUsers(req.user)) {
    return res.status(403).json({ message: 'Only super admin can manage departments' });
  }
  next();
}, async (req, res) => {
  try {
    const { name, locationId, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const department = await Department.create({
      name: name.trim(),
      locationId: locationId || undefined,
      description: description?.trim() || undefined,
    });
    res.status(201).json(department);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', (req, res, next) => {
  if (!canManageUsers(req.user)) {
    return res.status(403).json({ message: 'Only super admin can manage departments' });
  }
  next();
}, async (req, res) => {
  try {
    const { name, locationId, description } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (locationId !== undefined) update.locationId = locationId || null;
    if (description !== undefined) update.description = description?.trim() || undefined;
    const department = await Department.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!department) return res.status(404).json({ message: 'Department not found' });
    res.json(department);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', (req, res, next) => {
  if (!canManageUsers(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id).lean();
    if (!department) return res.status(404).json({ message: 'Department not found' });
    await Department.deleteOne({ _id: req.params.id });
    res.json({ message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
