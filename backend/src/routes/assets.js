import express from 'express';
import { Asset, AssetLog, User, Organization, AssetTemplate } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { generateQrDataUrl, getAssetPublicUrl } from '../services/qrService.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';
import { assetFilterForUser, canEdit, canRead, canViewAsset } from '../services/permissions.js';
import {
  buildAssetEditChanges,
  createAssetEditLog,
  createAssetNoteLog,
  createAssetMaintenanceLog,
  formatChangesSummary,
  serializeAssetLogs,
  serializeTimelineEntry,
  requiresChangeReason,
} from '../services/assetLogService.js';
import { env } from '../config/env.js';
import {
  applyTemplateToAssetBody,
  validateAssetAgainstTemplate,
} from '../services/assetTemplateService.js';
import { buildAssetListQuery, resolveAssetSort } from '../services/assetQueryService.js';

const router = express.Router();

router.use(protect);

function requireCanEdit(req, res, next) {
  if (!canEdit(req.user, 'assets', req)) {
    return res.status(403).json({ message: 'Forbidden: you do not have permission to edit' });
  }
  next();
}

function requireCanRead(req, res, next) {
  if (!canRead(req.user, 'assets', req)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}

router.get('/', requireCanRead, async (req, res) => {
  try {
    const { page = 1, limit = 25, sort = 'createdAt', order = 'desc' } = req.query;
    const baseFilter = assetFilterForUser(req.user);
    const filter = await buildAssetListQuery(baseFilter, req.query);
    const sortOpt = resolveAssetSort(sort, order);
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;
    const [assets, total] = await Promise.all([
      Asset.find(filter)
        .populate('locationId', 'name path type')
        .populate('departmentId', 'name')
        .populate('groupId', 'name')
        .populate('assignedTo', 'name email')
        .populate('vendorId', 'name vendorId')
        .sort(sortOpt)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Asset.countDocuments(filter),
    ]);
    res.json({ assets, total, page: pageNum, limit: limitNum });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/timeline', requireCanRead, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id).lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (!canViewAsset(req.user, asset)) {
      return res.status(403).json({ message: 'You do not have access to this asset' });
    }
    const logs = await AssetLog.find({ assetId: req.params.id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ timeline: logs.map(serializeTimelineEntry) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/logs', requireCanRead, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id).lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (!canViewAsset(req.user, asset)) {
      return res.status(403).json({ message: 'You do not have access to this asset' });
    }
    const logs = await AssetLog.find({ assetId: req.params.id, type: 'edit' })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ logs: serializeAssetLogs(logs) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/notes', requireCanEdit, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id).lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (!canViewAsset(req.user, asset)) {
      return res.status(403).json({ message: 'You do not have access to this asset' });
    }

    const text = req.body?.text?.trim();
    if (!text) return res.status(400).json({ message: 'Note text is required' });

    const noteLog = await createAssetNoteLog(AssetLog, {
      assetId: asset._id,
      userId: req.user._id,
      text,
    });

    await logAudit(req.user._id, AUDIT_ACTIONS.ASSET_NOTE_ADDED, AUDIT_RESOURCES.ASSET, asset._id, {
      resourceName: `${asset.name} (${asset.assetId})`,
      description: `Added note on asset "${asset.name}"`,
      details: { note: text },
      severity: 'low',
      ...getRequestMetadata(req),
    });

    const populated = await AssetLog.findById(noteLog._id).populate('userId', 'name email').lean();
    res.status(201).json({ entry: serializeTimelineEntry(populated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', requireCanRead, async (req, res) => {
  try {
    let asset = await Asset.findById(req.params.id)
      .populate('locationId', 'name path type code')
      .populate('departmentId', 'name')
      .populate('groupId', 'name')
      .populate('vendorId', 'name vendorId')
      .populate('assignedTo', 'name email')
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (!canViewAsset(req.user, asset)) {
      return res.status(403).json({ message: 'You do not have access to this asset' });
    }
    if (!asset.qrCodeUrl) {
      const url = getAssetPublicUrl(asset._id.toString(), env.frontendUrl);
      const qrCodeUrl = await generateQrDataUrl(url);
      if (qrCodeUrl) {
        await Asset.updateOne({ _id: asset._id }, { qrCodeUrl });
        asset = { ...asset, qrCodeUrl };
      }
    }
    res.json(asset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireCanEdit, async (req, res) => {
  try {
    // Check subscription limits
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    const now = new Date();
    const isExpired = org.subscriptionEndDate && org.subscriptionEndDate < now;

    const TIER_LIMITS = {
      free: 50,
      pro: 200,
      premium: 1000,
    };

    // Treat expired as free
    const tier = isExpired ? 'free' : (org.subscriptionTier || 'free');
    const limit = TIER_LIMITS[tier] || 50;
    const assetCount = await Asset.countDocuments({ organizationId: req.user.organizationId });

    if (assetCount >= limit) {
      const message = isExpired
        ? 'Subscription expired. Renew to add more assets.'
        : `Asset limit reached for ${tier} plan (${limit} assets). Upgrade to add more.`;
      return res.status(403).json({ message });
    }

    const assignedToName = req.body.assignedToName !== undefined ? String(req.body.assignedToName).trim() : '';
    const assignedToEmployeeCode =
      req.body.assignedToEmployeeCode !== undefined ? String(req.body.assignedToEmployeeCode).trim() : '';

    let template = null;
    if (req.body.templateId) {
      template = await AssetTemplate.findOne({
        _id: req.body.templateId,
        organizationId: req.user.organizationId,
      }).lean();
      if (!template) return res.status(400).json({ message: 'Invalid template selected' });
    } else if (req.body.category) {
      template = await AssetTemplate.findOne({
        organizationId: req.user.organizationId,
        name: req.body.category,
      }).lean();
    }

    const templateValidation = validateAssetAgainstTemplate(
      { ...req.body, customFields: req.body.customFields },
      template
    );
    if (!templateValidation.ok) {
      return res.status(400).json({ message: templateValidation.message });
    }

    let body = applyTemplateToAssetBody(
      {
        ...req.body,
        createdBy: req.user._id,
        updatedBy: req.user._id,
        organizationId: req.user.organizationId,
        assignedToName: assignedToName || undefined,
        assignedToEmployeeCode: assignedToEmployeeCode || undefined,
        assignedAt: assignedToName || assignedToEmployeeCode ? new Date() : undefined,
        tags: Array.isArray(req.body.tags) ? req.body.tags : undefined,
      },
      template
    );

    // Convert empty strings to null for ObjectId fields to prevent casting errors
    const objectIdFields = ['vendorId', 'locationId', 'departmentId', 'assignedTo', 'purchaseInvoiceId', 'groupId'];
    objectIdFields.forEach(field => {
      if (body[field] === '' || body[field] === 'null' || body[field] === 'undefined') {
        body[field] = null;
      }
    });

    const asset = await Asset.create(body);
    const url = getAssetPublicUrl(asset._id.toString(), env.frontendUrl);
    const qrCodeUrl = await generateQrDataUrl(url);
    if (qrCodeUrl) {
      await Asset.updateOne({ _id: asset._id }, { qrCodeUrl });
    }

    // Enhanced audit logging
    await logAudit(req.user._id, AUDIT_ACTIONS.ASSET_CREATED, AUDIT_RESOURCES.ASSET, asset._id, {
      resourceName: `${asset.name} (${asset.assetId})`,
      description: `Created asset "${asset.name}" with ID ${asset.assetId}`,
      details: {
        assetId: asset.assetId,
        name: asset.name,
        category: asset.category,
        status: asset.status
      },
      severity: 'low',
      ...getRequestMetadata(req)
    });

    const populated = await Asset.findById(asset._id)
      .populate('locationId', 'name path')
      .populate('departmentId', 'name')
      .populate('groupId', 'name')
      .populate('assignedTo', 'name email')
      .lean();

    await createAssetEditLog(AssetLog, {
      assetId: asset._id,
      userId: req.user._id,
      type: 'created',
      fieldChanges: [{ field: 'created', label: 'Created', oldValue: '—', newValue: asset.name }],
      summary: `Created: ${asset.name}`,
    });

    res.status(201).json({ ...populated, qrCodeUrl: qrCodeUrl || populated.qrCodeUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', requireCanEdit, async (req, res) => {
  try {
    const prev = await Asset.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ message: 'Asset not found' });

    const changeReason = req.body.changeReason !== undefined ? String(req.body.changeReason).trim() : '';

    const objectIdFields = ['vendorId', 'locationId', 'departmentId', 'assignedTo', 'purchaseInvoiceId', 'groupId'];
    const patchForLog = { ...req.body };
    delete patchForLog.changeReason;
    objectIdFields.forEach((field) => {
      if (patchForLog[field] === '' || patchForLog[field] === 'null' || patchForLog[field] === 'undefined') {
        patchForLog[field] = null;
      }
    });
    const pendingEditLog = await buildAssetEditChanges(prev, patchForLog);

    if (pendingEditLog && requiresChangeReason(pendingEditLog.fieldChanges) && !changeReason) {
      return res.status(400).json({
        message:
          'A change reason is required when modifying warranty, location, assignee, status, cost, or other important fields',
        importantChanges: pendingEditLog.fieldChanges.filter((c) =>
          ['status', 'locationId', 'departmentId', 'assignedTo', 'assignedToName', 'assignedToEmployeeCode',
            'warrantyExpiry', 'amcExpiry', 'nextMaintenanceDate', 'cost', 'purchaseDate', 'vendorId', 'condition'].includes(c.field)
        ),
      });
    }

    const update = { ...req.body, updatedBy: req.user._id };
    delete update.changeReason;
    objectIdFields.forEach(field => {
      if (update[field] === '' || update[field] === 'null' || update[field] === 'undefined') {
        update[field] = null;
      }
    });

    // Assignment (name + employee code) — optional; may be cleared
    if (update.assignedToName !== undefined) {
      update.assignedToName = String(update.assignedToName).trim() || null;
    }
    if (update.assignedToEmployeeCode !== undefined) {
      update.assignedToEmployeeCode = String(update.assignedToEmployeeCode).trim() || null;
    }

    const assignmentFields = new Set(['assignedTo', 'assignedToName', 'assignedToEmployeeCode']);
    const changedFieldKeys = pendingEditLog?.fieldChanges?.map((c) => c.field) ?? [];
    const assignmentChanged = changedFieldKeys.some((f) => assignmentFields.has(f));

    if (assignmentChanged) {
      update.assignedAt = new Date();
    }

    let auditAction = AUDIT_ACTIONS.ASSET_UPDATED;
    let auditDescription = pendingEditLog?.summary || `Updated asset "${prev.name}"`;
    let auditSeverity = 'low';

    if (assignmentChanged && changedFieldKeys.every((f) => assignmentFields.has(f))) {
      auditAction = AUDIT_ACTIONS.ASSET_ASSIGNED;
      auditSeverity = 'medium';
    } else if (changedFieldKeys.includes('status')) {
      auditSeverity = 'medium';
    }

    // Track maintenance history when status changes
    if (update.status && update.status !== prev.status) {
      const now = new Date();
      const currentAsset = await Asset.findById(req.params.id);
      const history = currentAsset.maintenanceHistory || [];

      if (update.status === 'under_maintenance') {
        const hasOpenEntry = history.length > 0 && !history[history.length - 1].endDate;
        if (!hasOpenEntry) {
          update.$push = {
            maintenanceHistory: {
              startDate: now,
              reason: update.maintenanceReason || changeReason || 'Status changed to under maintenance',
            },
          };
          if (!update.maintenanceStartDate) update.maintenanceStartDate = now;
        }
        await createAssetMaintenanceLog(AssetLog, {
          assetId: prev._id,
          userId: req.user._id,
          summary: 'Entered maintenance',
          notes: update.maintenanceReason || changeReason || undefined,
        });
      } else if (prev.status === 'under_maintenance') {
        const lastIdx = history.length - 1;
        const hasOpenEntry = lastIdx >= 0 && !history[lastIdx].endDate;
        const startDate = prev.maintenanceStartDate;
        const durationMinutes = startDate ? Math.round((now - new Date(startDate)) / 60000) : 0;

        if (hasOpenEntry) {
          update[`maintenanceHistory.${lastIdx}.endDate`] = now;
          update[`maintenanceHistory.${lastIdx}.durationMinutes`] = durationMinutes;
        } else {
          update.$push = {
            maintenanceHistory: {
              startDate: startDate || now,
              endDate: now,
              reason: prev.maintenanceReason || 'Maintenance completed',
              durationMinutes,
            },
          };
        }
        if (!update.maintenanceCompletedDate) update.maintenanceCompletedDate = now;
        update.maintenanceStartDate = null;
        await createAssetMaintenanceLog(AssetLog, {
          assetId: prev._id,
          userId: req.user._id,
          summary: 'Maintenance completed',
          notes: changeReason || undefined,
        });
      }
    }

    const asset = await Asset.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('locationId', 'name path')
      .populate('departmentId', 'name')
      .populate('groupId', 'name')
      .populate('assignedTo', 'name email')
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    if (pendingEditLog) {
      await createAssetEditLog(AssetLog, {
        assetId: prev._id,
        userId: req.user._id,
        ...pendingEditLog,
        changeReason: changeReason || undefined,
      });
    }

    const fieldChanges = pendingEditLog?.fieldChanges ?? [];

    await logAudit(req.user._id, auditAction, AUDIT_RESOURCES.ASSET, asset._id, {
      resourceName: `${asset.name} (${asset.assetId})`,
      description: auditDescription,
      details: {
        fieldChanges,
        changeReason: changeReason || null,
        summary: pendingEditLog?.summary || formatChangesSummary(fieldChanges) || null,
      },
      severity: auditSeverity,
      ...getRequestMetadata(req),
    });

    if (!asset.qrCodeUrl) {
      const url = getAssetPublicUrl(asset._id.toString(), env.frontendUrl);
      const qrCodeUrl = await generateQrDataUrl(url);
      if (qrCodeUrl) {
        await Asset.updateOne({ _id: asset._id }, { qrCodeUrl });
        asset.qrCodeUrl = qrCodeUrl;
      }
    }

    res.json(asset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', requireCanEdit, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id).lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    await Asset.deleteOne({ _id: req.params.id });
    await logAudit(req.user._id, 'asset.deleted', 'asset', asset._id, { name: asset.name });
    res.json({ message: 'Asset deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
