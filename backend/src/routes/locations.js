import express from 'express';
import { Location } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canEdit } from '../services/permissions.js';

const router = express.Router();

router.use(protect);

function requireCanEdit(req, res, next) {
  if (!canEdit(req.user)) {
    return res.status(403).json({ message: 'Forbidden: you do not have permission to edit' });
  }
  next();
}

router.get('/', async (req, res) => {
  try {
    const { parentId, type } = req.query;
    const filter = { organizationId: req.user.organizationId };
    if (parentId !== undefined) filter.parentId = parentId || null;
    if (type) filter.type = type;
    const locations = await Location.find(filter).sort({ name: 1 }).lean();
    res.json({ locations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const location = await Location.findOne({ 
      _id: req.params.id, 
      organizationId: req.user.organizationId 
    }).lean();
    if (!location) return res.status(404).json({ message: 'Location not found' });
    res.json(location);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireCanEdit, async (req, res) => {
  try {
    const { name, type, parentId, code } = req.body;
    if (!name || !type) {
      return res.status(400).json({ message: 'name and type are required' });
    }
    
    // Verify parentId belongs to same organization if provided
    if (parentId) {
      const parentLocation = await Location.findOne({ 
        _id: parentId, 
        organizationId: req.user.organizationId 
      });
      if (!parentLocation) {
        return res.status(400).json({ message: 'Invalid parent location' });
      }
    }
    
    const location = await Location.create({ 
      name, 
      type, 
      parentId: parentId || null, 
      code,
      organizationId: req.user.organizationId 
    });
    res.status(201).json(location);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', requireCanEdit, async (req, res) => {
  try {
    const { name, type, parentId, code } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (type !== undefined) update.type = type;
    if (parentId !== undefined) {
      // Verify parentId belongs to same organization if provided
      if (parentId) {
        const parentLocation = await Location.findOne({ 
          _id: parentId, 
          organizationId: req.user.organizationId 
        });
        if (!parentLocation) {
          return res.status(400).json({ message: 'Invalid parent location' });
        }
      }
      update.parentId = parentId || null;
    }
    if (code !== undefined) update.code = code;
    
    const location = await Location.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId }, 
      update, 
      { new: true }
    ).lean();
    if (!location) return res.status(404).json({ message: 'Location not found' });
    res.json(location);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', requireCanEdit, async (req, res) => {
  try {
    const location = await Location.findOneAndDelete({ 
      _id: req.params.id, 
      organizationId: req.user.organizationId 
    });
    if (!location) return res.status(404).json({ message: 'Location not found' });
    
    // Also delete child locations
    await Location.deleteMany({ parentId: req.params.id });
    
    res.json({ message: 'Location deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
