import express from 'express';
import { OrgRole, User } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canManageUsers, canReadRoles } from '../services/permissions.js';
import {
  PERMISSION_TABS,
  validatePermissionsPayload,
  compactPermissions,
  hasGrantedPermissions,
} from '../constants/permissionTabs.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';

const router = express.Router();
router.use(protect);

/** List permission tab metadata + org custom roles */
router.get('/', async (req, res) => {
  try {
    if (!canReadRoles(req.user, req) && !canManageUsers(req.user, req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const roles = await OrgRole.find({
      organizationId: req.user.organizationId,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    res.json({ tabs: PERMISSION_TABS, roles });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Create custom role — super_admin only */
router.post('/', async (req, res) => {
  try {
    if (!canManageUsers(req.user, req)) {
      return res.status(403).json({ message: 'Only users with write access can create roles' });
    }

    const { name, description, permissions } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    const validation = validatePermissionsPayload(permissions);
    if (!validation.ok) return res.status(400).json({ message: validation.message });
    if (!hasGrantedPermissions(validation.permissions)) {
      return res.status(400).json({ message: 'Select at least one tab for this role' });
    }

    const existing = await OrgRole.findOne({
      organizationId: req.user.organizationId,
      name: name.trim(),
      isActive: true,
    });
    if (existing) {
      return res.status(400).json({ message: 'A role with this name already exists' });
    }

    const role = await OrgRole.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description: description?.trim() || '',
      permissions: compactPermissions(validation.permissions),
    });

    await logAudit(req.user._id, AUDIT_ACTIONS.USER_CREATED, AUDIT_RESOURCES.USER, role._id, {
      resourceName: role.name,
      description: `Created custom role "${role.name}"`,
      severity: 'medium',
      ...getRequestMetadata(req),
    });

    res.status(201).json(role);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Update custom role — super_admin only */
router.patch('/:id', async (req, res) => {
  try {
    if (!canManageUsers(req.user, req)) {
      return res.status(403).json({ message: 'Only Super Admin can update roles' });
    }

    const role = await OrgRole.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isActive: true,
    });
    if (!role) return res.status(404).json({ message: 'Role not found' });

    const { name, description, permissions } = req.body;
    if (name !== undefined) {
      if (!name?.trim()) return res.status(400).json({ message: 'Role name is required' });
      const duplicate = await OrgRole.findOne({
        organizationId: req.user.organizationId,
        name: name.trim(),
        isActive: true,
        _id: { $ne: role._id },
      });
      if (duplicate) {
        return res.status(400).json({ message: 'A role with this name already exists' });
      }
      role.name = name.trim();
    }
    if (description !== undefined) role.description = description?.trim() || '';
    if (permissions !== undefined) {
      const validation = validatePermissionsPayload(permissions);
      if (!validation.ok) return res.status(400).json({ message: validation.message });
      if (!hasGrantedPermissions(validation.permissions)) {
        return res.status(400).json({ message: 'Select at least one tab for this role' });
      }
      role.permissions = compactPermissions(validation.permissions);
    }

    await role.save();

    await logAudit(req.user._id, AUDIT_ACTIONS.USER_UPDATED, AUDIT_RESOURCES.USER, role._id, {
      resourceName: role.name,
      description: `Updated custom role "${role.name}"`,
      severity: 'medium',
      ...getRequestMetadata(req),
    });

    res.json(role);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Delete custom role — super_admin only */
router.delete('/:id', async (req, res) => {
  try {
    if (!canManageUsers(req.user, req)) {
      return res.status(403).json({ message: 'Only Super Admin can delete roles' });
    }

    const role = await OrgRole.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isActive: true,
    });
    if (!role) return res.status(404).json({ message: 'Role not found' });

    const assignedCount = await User.countDocuments({
      organizationId: req.user.organizationId,
      customRoleId: role._id,
      isActive: true,
    });
    if (assignedCount > 0) {
      return res.status(400).json({
        message: `Cannot delete role — ${assignedCount} user(s) are assigned to it`,
      });
    }

    role.isActive = false;
    await role.save();

    await logAudit(req.user._id, AUDIT_ACTIONS.USER_DELETED, AUDIT_RESOURCES.USER, role._id, {
      resourceName: role.name,
      description: `Deleted custom role "${role.name}"`,
      severity: 'medium',
      ...getRequestMetadata(req),
    });

    res.json({ message: 'Role deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
