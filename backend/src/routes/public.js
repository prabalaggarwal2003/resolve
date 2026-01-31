import express from 'express';
import { Asset, Issue, Notification, User } from '../models/index.js';
import { generateTicketId } from '../services/ticketId.js';

const router = express.Router();

/**
 * Public asset by ID — no auth. Used when someone scans the asset QR code.
 */
router.get('/assets/:id', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('locationId', 'name path type code')
      .populate('departmentId', 'name')
      .select('name assetId category model serialNumber status purchaseDate vendor cost warrantyExpiry amcExpiry nextMaintenanceDate photos documents locationId departmentId')
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    res.json(asset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Public report submission (no auth). Used when someone scans QR and fills the report form.
 * Similar problems (same asset + same issue type) are grouped into one issue.
 */
router.post('/report', async (req, res) => {
  try {
    const { assetId, reporterName, reporterEmail, reporterPhone, issueType, title, description, photos } = req.body;
    if (!assetId || !reporterName || !reporterEmail || !description) {
      return res.status(400).json({
        message: 'Asset, your name, email and description are required',
      });
    }
    const asset = await Asset.findById(assetId).lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const category = issueType || 'other';
    const reportEntry = {
      reporterName: String(reporterName).trim(),
      reporterEmail: String(reporterEmail).trim().toLowerCase(),
      reporterPhone: reporterPhone ? String(reporterPhone).trim() : undefined,
      description: String(description).trim(),
      photos: Array.isArray(photos) ? photos.filter((p) => p?.url).map((p) => ({ url: p.url })) : [],
    };

    // Find open issue for same asset + same category (group similar problems)
    const existing = await Issue.findOne({
      assetId,
      category,
      status: 'open',
    }).lean();

    if (existing) {
      await Issue.updateOne(
        { _id: existing._id },
        { $push: { reports: reportEntry } }
      );
      if (asset.assignedTo) {
        await Notification.create({
          userId: asset.assignedTo,
          type: 'report_submitted',
          title: 'New report on your asset',
          body: `${existing.ticketId} — ${asset.name}`,
          link: `/dashboard/issues/${existing._id}`,
          metadata: { issueId: existing._id },
        });
      }
      return res.status(201).json({
        merged: true,
        message: 'Your report was added to an existing issue.',
        ticketId: existing.ticketId,
        issueId: existing._id,
      });
    }

    const ticketId = await generateTicketId();
    const displayTitle = title?.trim() || `${category.replace(/_/g, ' ')} — ${asset.name}`;
    const issue = await Issue.create({
      ticketId,
      assetId,
      title: displayTitle,
      description: reportEntry.description,
      category,
      status: 'open',
      reporterName: reportEntry.reporterName,
      reporterEmail: reportEntry.reporterEmail,
      reporterPhone: reportEntry.reporterPhone,
      photos: reportEntry.photos,
      reports: [reportEntry],
      locationId: asset.locationId,
    });

    const admins = await User.find({ role: { $in: ['super_admin', 'admin', 'manager', 'principal'] }, isActive: true }).limit(50).select('_id').lean();
    const notifyUserIds = [...new Set([...admins.map((u) => u._id.toString()), asset.assignedTo?.toString()].filter(Boolean))];
    const assignedUserIdStr = asset.assignedTo?.toString();
    await Notification.insertMany(notifyUserIds.map((userId) => ({
      userId,
      type: 'report_submitted',
      title: userId === assignedUserIdStr ? 'New report on your asset' : 'New report submitted',
      body: `${ticketId} — ${asset.name}`,
      link: `/dashboard/issues/${issue._id}`,
      metadata: { issueId: issue._id },
    })));

    return res.status(201).json({
      merged: false,
      message: 'Thank you. Your report has been logged.',
      ticketId: issue.ticketId,
      issueId: issue._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
