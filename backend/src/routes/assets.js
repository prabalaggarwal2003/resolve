import express from 'express';
import { Asset, AssetLog, User } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { generateQrDataUrl, getAssetPublicUrl } from '../services/qrService.js';
import { logAudit } from '../services/auditService.js';
import { assetFilterForUser, canEdit, canViewAsset } from '../services/permissions.js';
import { env } from '../config/env.js';

const router = express.Router();

router.use(protect);

const SORT_FIELDS = { purchaseDate: 1, createdAt: -1, updatedAt: -1, cost: -1, name: 1 };

function requireCanEdit(req, res, next) {
  if (!canEdit(req.user)) {
    return res.status(403).json({ message: 'Forbidden: you do not have permission to edit' });
  }
  next();
}

router.get('/', async (req, res) => {
  try {
    const { category, locationId, status, search, assignedTo, departmentId, page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = req.query;
    const filter = { ...assetFilterForUser(req.user) };
    if (category) filter.category = category;
    if (locationId) filter.locationId = locationId;
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (departmentId) filter.departmentId = departmentId;
    if (search && search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: re },
        { assetId: re },
        { serialNumber: re },
        { model: re },
      ];
    }
    const sortKey = SORT_FIELDS[sort] !== undefined ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOpt = { [sortKey]: sortOrder };
    const skip = (Number(page) - 1) * Number(limit);
    const [assets, total] = await Promise.all([
      Asset.find(filter)
        .populate('locationId', 'name path type')
        .populate('departmentId', 'name')
        .populate('assignedTo', 'name email')
        .sort(sortOpt)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Asset.countDocuments(filter),
    ]);
    res.json({ assets, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id).lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (!canViewAsset(req.user, asset)) {
      return res.status(403).json({ message: 'You do not have access to this asset' });
    }
    const logs = await AssetLog.find({ assetId: req.params.id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    let asset = await Asset.findById(req.params.id)
      .populate('locationId', 'name path type code')
      .populate('departmentId', 'name')
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
    const body = { 
      ...req.body, 
      createdBy: req.user._id, 
      updatedBy: req.user._id,
      organizationId: req.user.organizationId,
    };
    const asset = await Asset.create(body);
    const url = getAssetPublicUrl(asset._id.toString(), env.frontendUrl);
    const qrCodeUrl = await generateQrDataUrl(url);
    if (qrCodeUrl) {
      await Asset.updateOne({ _id: asset._id }, { qrCodeUrl });
    }
    await logAudit(req.user._id, 'asset.created', 'asset', asset._id, { name: asset.name });
    const populated = await Asset.findById(asset._id)
      .populate('locationId', 'name path')
      .populate('departmentId', 'name')
      .populate('assignedTo', 'name email')
      .lean();
    res.status(201).json({ ...populated, qrCodeUrl: qrCodeUrl || populated.qrCodeUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', requireCanEdit, async (req, res) => {
  try {
    const prev = await Asset.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ message: 'Asset not found' });
    const update = { ...req.body, updatedBy: req.user._id };
    if (update.assignedTo !== undefined) {
      update.assignedAt = update.assignedTo ? new Date() : null;
      if (prev.assignedTo && !update.assignedTo) {
        await AssetLog.create({
          assetId: prev._id,
          userId: prev.assignedTo,
          type: 'check_out',
          unassignedAt: new Date(),
        });
      }
      if (update.assignedTo) {
        await AssetLog.create({
          assetId: prev._id,
          userId: update.assignedTo,
          type: 'check_in',
          assignedAt: new Date(),
        });
      }
    }
    const asset = await Asset.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('locationId', 'name path')
      .populate('departmentId', 'name')
      .populate('assignedTo', 'name email')
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    
    // Only generate QR code if it doesn't exist
    if (!asset.qrCodeUrl) {
      const url = getAssetPublicUrl(asset._id.toString(), env.frontendUrl);
      const qrCodeUrl = await generateQrDataUrl(url);
      if (qrCodeUrl) {
        await Asset.updateOne({ _id: asset._id }, { qrCodeUrl });
        asset.qrCodeUrl = qrCodeUrl;
      }
    }
    
    await logAudit(req.user._id, 'asset.updated', 'asset', asset._id, { changed: Object.keys(req.body) });
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
