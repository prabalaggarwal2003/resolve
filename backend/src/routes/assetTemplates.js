import express from 'express';
import { AssetTemplate } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canRead, canWrite } from '../services/permissions.js';
import {
  ensureDefaultTemplates,
  validateTemplatePayload,
  normalizeTemplateFields,
} from '../services/assetTemplateService.js';
import { ensureDefaultAssetGroups } from '../services/assetGroupService.js';
import {
  DEFAULT_ASSET_STATUSES,
  TEMPLATE_EDITOR_FIELD_TYPES,
} from '../constants/assetTemplateDefaults.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';

const router = express.Router();
router.use(protect);

function requireTemplateRead(req, res, next) {
  if (!canRead(req.user, 'assets', req)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}

function requireTemplateWrite(req, res, next) {
  if (!canWrite(req.user, 'assets', req)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}

router.get('/meta', requireTemplateRead, (req, res) => {
  res.json({ fieldTypes: TEMPLATE_EDITOR_FIELD_TYPES, defaultStatuses: DEFAULT_ASSET_STATUSES });
});

router.get('/', requireTemplateRead, async (req, res) => {
  try {
    await ensureDefaultTemplates(req.user.organizationId, req.user._id);
    await ensureDefaultAssetGroups(req.user.organizationId, req.user._id);
    const templates = await AssetTemplate.find({ organizationId: req.user.organizationId })
      .sort({ sortOrder: 1, isDefault: -1, name: 1 })
      .lean();
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', requireTemplateRead, async (req, res) => {
  try {
    const template = await AssetTemplate.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).lean();
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireTemplateWrite, async (req, res) => {
  try {
    const validation = validateTemplatePayload(req.body);
    if (!validation.ok) return res.status(400).json({ message: validation.message });

    const existing = await AssetTemplate.findOne({
      organizationId: req.user.organizationId,
      name: validation.data.name,
    });
    if (existing) return res.status(400).json({ message: 'A template with this name already exists' });

    const template = await AssetTemplate.create({
      organizationId: req.user.organizationId,
      ...validation.data,
      isDefault: false,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await logAudit(req.user._id, AUDIT_ACTIONS.CREATED || 'created', AUDIT_RESOURCES.ASSET || 'asset', template._id, {
      resourceName: template.name,
      description: `Created asset template "${template.name}"`,
      severity: 'low',
      ...getRequestMetadata(req),
    });

    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', requireTemplateWrite, async (req, res) => {
  try {
    const template = await AssetTemplate.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const validation = validateTemplatePayload({
      name: req.body.name ?? template.name,
      description: req.body.description ?? template.description,
      fields: req.body.fields ?? template.fields,
      statuses: req.body.statuses ?? template.statuses,
      tagSuggestions: req.body.tagSuggestions ?? template.tagSuggestions,
    });
    if (!validation.ok) return res.status(400).json({ message: validation.message });

    if (validation.data.name !== template.name) {
      const dup = await AssetTemplate.findOne({
        organizationId: req.user.organizationId,
        name: validation.data.name,
        _id: { $ne: template._id },
      });
      if (dup) return res.status(400).json({ message: 'A template with this name already exists' });
    }

    Object.assign(template, validation.data, { updatedBy: req.user._id });
    await template.save();

    res.json(template);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', requireTemplateWrite, async (req, res) => {
  try {
    const template = await AssetTemplate.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    await template.deleteOne();
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
