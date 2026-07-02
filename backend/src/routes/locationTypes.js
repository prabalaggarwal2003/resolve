import express from 'express';
import { LocationType } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canEdit, canRead } from '../services/permissions.js';
import {
  getLocationTypes,
  createLocationType,
  slugKey,
} from '../services/locationService.js';

const router = express.Router();

router.use(protect);

function requireCanEdit(req, res, next) {
  if (!canEdit(req.user, 'locations', req)) {
    return res.status(403).json({ message: 'Forbidden: you do not have permission to edit' });
  }
  next();
}

function requireCanRead(req, res, next) {
  if (!canRead(req.user, 'locations', req)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}

router.get('/', requireCanRead, async (req, res) => {
  try {
    const types = await getLocationTypes(req.user.organizationId);
    res.json({ types });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireCanEdit, async (req, res) => {
  try {
    const { name, icon, color, key } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
    const type = await createLocationType(req.user.organizationId, {
      name: name.trim(),
      icon,
      color,
      key: key || slugKey(name),
    });
    res.status(201).json(type);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id', requireCanEdit, async (req, res) => {
  try {
    const { name, icon, color, order } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (icon !== undefined) update.icon = icon;
    if (color !== undefined) update.color = color;
    if (order !== undefined) update.order = order;

    const type = await LocationType.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      update,
      { new: true }
    ).lean();
    if (!type) return res.status(404).json({ message: 'Location type not found' });
    res.json(type);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', requireCanEdit, async (req, res) => {
  try {
    const type = await LocationType.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!type) return res.status(404).json({ message: 'Location type not found' });
    if (type.isDefault) {
      return res.status(400).json({ message: 'Default location types cannot be deleted' });
    }
    await type.deleteOne();
    res.json({ message: 'Location type deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
