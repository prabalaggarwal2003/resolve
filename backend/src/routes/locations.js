import express from 'express';
import { Location } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canEdit } from '../services/permissions.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';

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
    const locations = await Location.find(filter)
      .populate('departmentId', 'name')
      .sort({ name: 1 })
      .lean();
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
    }).populate('departmentId', 'name').lean();
    if (!location) return res.status(404).json({ message: 'Location not found' });
    res.json(location);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireCanEdit, async (req, res) => {
  try {
    const { name, type, parentId, code, departmentId } = req.body;
    if (!name || !type) {
      return res.status(400).json({ message: 'name and type are required' });
    }
    if (parentId) {
      const parentLocation = await Location.findOne({ _id: parentId, organizationId: req.user.organizationId });
      if (!parentLocation) return res.status(400).json({ message: 'Invalid parent location' });
    }
    const location = await Location.create({
      name, type, parentId: parentId || null, code,
      departmentId: departmentId || null,
      organizationId: req.user.organizationId
    });
    const populated = await Location.findById(location._id).populate('departmentId', 'name').lean();
    await logAudit(req.user._id, AUDIT_ACTIONS.LOCATION_CREATED, AUDIT_RESOURCES.LOCATION, location._id, {
      resourceName: name, description: `Created ${type} "${name}"`, severity: 'low', ...getRequestMetadata(req)
    });
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', requireCanEdit, async (req, res) => {
  try {
    const { name, type, parentId, code, departmentId } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (type !== undefined) update.type = type;
    if (parentId !== undefined) {
      if (parentId) {
        const parentLocation = await Location.findOne({ _id: parentId, organizationId: req.user.organizationId });
        if (!parentLocation) return res.status(400).json({ message: 'Invalid parent location' });
      }
      update.parentId = parentId || null;
    }
    if (code !== undefined) update.code = code;
    if (departmentId !== undefined) update.departmentId = departmentId || null;

    const location = await Location.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId }, 
      update, { new: true }
    ).populate('departmentId', 'name').lean();
    if (!location) return res.status(404).json({ message: 'Location not found' });
    await logAudit(req.user._id, AUDIT_ACTIONS.LOCATION_UPDATED, AUDIT_RESOURCES.LOCATION, location._id, {
      resourceName: location.name, description: `Updated location "${location.name}"`, severity: 'low', ...getRequestMetadata(req)
    });
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
    await logAudit(req.user._id, AUDIT_ACTIONS.LOCATION_DELETED, AUDIT_RESOURCES.LOCATION, location._id, {
      resourceName: location.name, description: `Deleted location "${location.name}"`, severity: 'medium', ...getRequestMetadata(req)
    });
    res.json({ message: 'Location deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
