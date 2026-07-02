import express from 'express';
import { Location } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canEdit, canRead } from '../services/permissions.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';
import {
  getLocationTree,
  searchLocations,
  deleteLocationSubtree,
  duplicateLocationBranch,
  moveLocation,
  bulkGenerateLocations,
  applyLocationTemplate,
  bulkMoveLocations,
  bulkDeleteLocations,
  getParentPath,
  buildPath,
  recomputePathsForSubtree,
  wouldCreateCycle,
  LOCATION_TEMPLATES,
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

router.get('/tree', requireCanRead, async (req, res) => {
  try {
    const tree = await getLocationTree(req.user.organizationId);
    res.json({ tree });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/search', requireCanRead, async (req, res) => {
  try {
    const results = await searchLocations(req.user.organizationId, req.query.q);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/templates', requireCanRead, async (req, res) => {
  res.json({
    templates: Object.entries(LOCATION_TEMPLATES).map(([key, t]) => ({
      key,
      name: t.name,
      description: t.description,
      rootType: t.rootType,
    })),
  });
});

router.get('/', requireCanRead, async (req, res) => {
  try {
    const { parentId, type } = req.query;
    const filter = { organizationId: req.user.organizationId };
    if (parentId !== undefined) filter.parentId = parentId || null;
    if (type) filter.type = type;
    const locations = await Location.find(filter)
      .populate('departmentId', 'name')
      .populate('managerId', 'name email')
      .sort({ name: 1 })
      .lean();
    res.json({ locations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', requireCanRead, async (req, res) => {
  try {
    const location = await Location.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    })
      .populate('departmentId', 'name')
      .populate('managerId', 'name email')
      .lean();
    if (!location) return res.status(404).json({ message: 'Location not found' });
    res.json(location);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/bulk-generate', requireCanEdit, async (req, res) => {
  try {
    const { parentId, type, start, end, namingPattern, namePrefix } = req.body;
    if (!type) return res.status(400).json({ message: 'type is required' });
    const created = await bulkGenerateLocations(req.user.organizationId, parentId || null, {
      type,
      start,
      end,
      namingPattern,
      namePrefix,
    });
    res.status(201).json({ locations: created, count: created.length });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/apply-template', requireCanEdit, async (req, res) => {
  try {
    const { templateKey, rootName } = req.body;
    if (!templateKey || !rootName?.trim()) {
      return res.status(400).json({ message: 'templateKey and rootName are required' });
    }
    const root = await applyLocationTemplate(req.user.organizationId, templateKey, rootName.trim());
    res.status(201).json({ location: root });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/bulk', requireCanEdit, async (req, res) => {
  try {
    const { action, ids, newParentId, mergeTargetId } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }

    if (action === 'delete') {
      const count = await bulkDeleteLocations(req.user.organizationId, ids);
      return res.json({ message: `Deleted ${count} location(s)`, count });
    }
    if (action === 'move') {
      const count = await bulkMoveLocations(req.user.organizationId, ids, newParentId || null);
      return res.json({ message: `Moved ${count} location(s)`, count });
    }
    if (action === 'merge') {
      if (!mergeTargetId) return res.status(400).json({ message: 'mergeTargetId is required' });
      const toMove = ids.filter((id) => String(id) !== String(mergeTargetId));
      await bulkMoveLocations(req.user.organizationId, toMove, mergeTargetId);
      return res.json({ message: `Merged ${toMove.length} location(s)` });
    }
    if (action === 'export') {
      const locations = await Location.find({
        _id: { $in: ids },
        organizationId: req.user.organizationId,
      }).lean();
      return res.json({ locations });
    }

    res.status(400).json({ message: 'Unknown action' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/', requireCanEdit, async (req, res) => {
  try {
    const {
      name,
      type,
      parentId,
      code,
      departmentId,
      description,
      capacity,
      managerId,
      notes,
    } = req.body;
    if (!name?.trim() || !type) {
      return res.status(400).json({ message: 'name and type are required' });
    }
    if (parentId) {
      const parentLocation = await Location.findOne({
        _id: parentId,
        organizationId: req.user.organizationId,
      });
      if (!parentLocation) return res.status(400).json({ message: 'Invalid parent location' });
    }

    const parentPath = await getParentPath(req.user.organizationId, parentId);
    const path = buildPath(name.trim(), parentPath);

    const location = await Location.create({
      name: name.trim(),
      type,
      parentId: parentId || null,
      path,
      code,
      departmentId: departmentId || null,
      description: description || '',
      capacity: capacity != null && capacity !== '' ? Number(capacity) : null,
      managerId: managerId || null,
      notes: notes || '',
      organizationId: req.user.organizationId,
    });
    const populated = await Location.findById(location._id)
      .populate('departmentId', 'name')
      .populate('managerId', 'name email')
      .lean();
    await logAudit(req.user._id, AUDIT_ACTIONS.LOCATION_CREATED, AUDIT_RESOURCES.LOCATION, location._id, {
      resourceName: name,
      description: `Created ${type} "${name}"`,
      severity: 'low',
      ...getRequestMetadata(req),
    });
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/duplicate', requireCanEdit, async (req, res) => {
  try {
    const { newName } = req.body;
    const copy = await duplicateLocationBranch(req.user.organizationId, req.params.id, newName);
    const populated = await Location.findById(copy._id)
      .populate('departmentId', 'name')
      .populate('managerId', 'name email')
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/move', requireCanEdit, async (req, res) => {
  try {
    const { parentId } = req.body;
    const moved = await moveLocation(req.user.organizationId, req.params.id, parentId || null);
    const populated = await Location.findById(moved._id)
      .populate('departmentId', 'name')
      .populate('managerId', 'name email')
      .lean();
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id', requireCanEdit, async (req, res) => {
  try {
    const {
      name,
      type,
      parentId,
      code,
      departmentId,
      description,
      capacity,
      managerId,
      notes,
    } = req.body;

    const existing = await Location.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!existing) return res.status(404).json({ message: 'Location not found' });

    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (type !== undefined) update.type = type;
    if (code !== undefined) update.code = code;
    if (departmentId !== undefined) update.departmentId = departmentId || null;
    if (description !== undefined) update.description = description;
    if (capacity !== undefined) update.capacity = capacity != null && capacity !== '' ? Number(capacity) : null;
    if (managerId !== undefined) update.managerId = managerId || null;
    if (notes !== undefined) update.notes = notes;

    if (parentId !== undefined) {
      if (parentId && (await wouldCreateCycle(req.user.organizationId, req.params.id, parentId))) {
        return res.status(400).json({ message: 'Cannot set parent: would create a circular hierarchy' });
      }
      if (parentId) {
        const parentLocation = await Location.findOne({
          _id: parentId,
          organizationId: req.user.organizationId,
        });
        if (!parentLocation) return res.status(400).json({ message: 'Invalid parent location' });
      }
      update.parentId = parentId || null;
    }

    Object.assign(existing, update);
    const parentPath = await getParentPath(req.user.organizationId, existing.parentId);
    existing.path = buildPath(existing.name, parentPath);
    await existing.save();
    await recomputePathsForSubtree(req.user.organizationId, existing._id);

    const location = await Location.findById(existing._id)
      .populate('departmentId', 'name')
      .populate('managerId', 'name email')
      .lean();

    await logAudit(req.user._id, AUDIT_ACTIONS.LOCATION_UPDATED, AUDIT_RESOURCES.LOCATION, location._id, {
      resourceName: location.name,
      description: `Updated location "${location.name}"`,
      severity: 'low',
      ...getRequestMetadata(req),
    });
    res.json(location);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', requireCanEdit, async (req, res) => {
  try {
    const location = await Location.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!location) return res.status(404).json({ message: 'Location not found' });

    const count = await deleteLocationSubtree(req.user.organizationId, req.params.id);
    await logAudit(req.user._id, AUDIT_ACTIONS.LOCATION_DELETED, AUDIT_RESOURCES.LOCATION, location._id, {
      resourceName: location.name,
      description: `Deleted location "${location.name}" and ${count - 1} descendant(s)`,
      severity: 'medium',
      ...getRequestMetadata(req),
    });
    res.json({ message: 'Location deleted successfully', count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
