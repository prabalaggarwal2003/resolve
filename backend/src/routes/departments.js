import express from 'express';
import { Department, Location } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { canManageUsers } from '../services/permissions.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const departments = await Department.find({ organizationId: req.user.organizationId })
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
    const department = await Department.findOne({ 
      _id: req.params.id, 
      organizationId: req.user.organizationId 
    })
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
    
    // Verify locationId belongs to same organization if provided
    if (locationId) {
      const location = await Location.findOne({ 
        _id: locationId, 
        organizationId: req.user.organizationId 
      });
      if (!location) {
        return res.status(400).json({ message: 'Invalid location' });
      }
    }
    
    const department = await Department.create({
      name: name.trim(),
      locationId: locationId || undefined,
      description: description?.trim() || undefined,
      organizationId: req.user.organizationId
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
    if (locationId !== undefined) {
      // Verify locationId belongs to same organization if provided
      if (locationId) {
        const location = await Location.findOne({ 
          _id: locationId, 
          organizationId: req.user.organizationId 
        });
        if (!location) {
          return res.status(400).json({ message: 'Invalid location' });
        }
      }
      update.locationId = locationId || null;
    }
    if (description !== undefined) update.description = description?.trim() || undefined;
    
    const department = await Department.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId }, 
      update, 
      { new: true }
    ).lean();
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
    const department = await Department.findOneAndDelete({ 
      _id: req.params.id, 
      organizationId: req.user.organizationId 
    });
    if (!department) return res.status(404).json({ message: 'Department not found' });
    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
