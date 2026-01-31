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
    const filter = {};
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
    const location = await Location.findById(req.params.id).lean();
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
    const location = await Location.create({ name, type, parentId: parentId || null, code });
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
    if (parentId !== undefined) update.parentId = parentId || null;
    if (code !== undefined) update.code = code;
    const location = await Location.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!location) return res.status(404).json({ message: 'Location not found' });
    res.json(location);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', requireCanEdit, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id).lean();
    if (!location) return res.status(404).json({ message: 'Location not found' });
    const children = await Location.countDocuments({ parentId: req.params.id });
    if (children > 0) {
      return res.status(400).json({ message: 'Cannot delete: location has child locations. Remove or reassign them first.' });
    }
    await Location.deleteOne({ _id: req.params.id });
    res.json({ message: 'Location deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
