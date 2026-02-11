import express from 'express';
import { Asset, Issue, Notification, User } from '../models/index.js';
import { generateTicketId } from '../services/ticketId.js';
import { getDeviceFingerprint, canReport, recordReportAttempt } from '../utils/rateLimiter.js';

const router = express.Router();

/**
 * Public asset by ID — no auth. Used when someone scans the asset QR code.
 */
router.get('/assets/:id', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('locationId', 'name path type code')
      .populate('departmentId', 'name')
      .select('name assetId category model serialNumber status condition maintenanceReason purchaseDate vendor cost warrantyExpiry amcExpiry nextMaintenanceDate photos documents locationId departmentId')
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    
    // Get previous issues for this asset (all issues since we group by date)
    const previousIssues = await Issue.find({ 
      assetId: req.params.id
    })
    .select('ticketId title description status createdAt reports')
    .populate('reports', 'reporterName reporterEmail createdAt')
    .sort({ createdAt: -1 })
    .lean();
    
    // Add previous issues to asset response
    asset.previousIssues = previousIssues.map(issue => ({
      ticketId: issue.ticketId,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      createdAt: issue.createdAt,
      reports: issue.reports.map(report => ({
        reporterName: report.reporterName,
        reporterEmail: report.reporterEmail,
        createdAt: report.createdAt
      }))
    }));
    
    res.json(asset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Public report page - shows asset and previous issues
 */
router.get('/report', async (req, res) => {
  try {
    const { assetId, assetName } = req.query;
    if (!assetId) {
      return res.status(400).json({ message: 'Asset ID is required' });
    }
    
    const asset = await Asset.findById(assetId)
      .populate('locationId', 'name path type code')
      .populate('departmentId', 'name')
      .select('name assetId category model serialNumber status condition maintenanceReason purchaseDate vendor cost warrantyExpiry amcExpiry nextMaintenanceDate photos documents locationId departmentId')
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    
    // Get previous issues for this asset (all issues since we group by date)
    const previousIssues = await Issue.find({ 
      assetId: assetId
    })
    .select('ticketId title description status createdAt reports')
    .populate('reports', 'reporterName reporterEmail createdAt')
    .sort({ createdAt: -1 })
    .lean();
    
    res.json({
      asset,
      previousIssues: previousIssues.map(issue => ({
        ticketId: issue.ticketId,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        createdAt: issue.createdAt,
        reports: issue.reports.map(report => ({
          reporterName: report.reporterName,
          reporterEmail: report.reporterEmail,
          createdAt: report.createdAt
        }))
      }))
    });
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

    // Rate limiting check
    const deviceId = getDeviceFingerprint(req);
    const rateLimitCheck = await canReport(deviceId, assetId);
    
    if (!rateLimitCheck.canReport) {
      return res.status(429).json({
        message: `You can report again after ${rateLimitCheck.timeRemaining} minutes`,
        nextReportAt: rateLimitCheck.nextReportAt,
        timeRemaining: rateLimitCheck.timeRemaining
      });
    }

    const category = issueType || 'other';
    const reportEntry = {
      reporterName: String(reporterName).trim(),
      reporterEmail: String(reporterEmail).trim().toLowerCase(),
      reporterPhone: reporterPhone ? String(reporterPhone).trim() : undefined,
      description: String(description).trim(),
      photos: Array.isArray(photos) ? photos.filter((p) => p?.url).map((p) => ({ url: p.url })) : [],
    };

    // Find issue for same asset + same category + same date (group by day)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const existing = await Issue.findOne({
      assetId,
      category,
      createdAt: { $gte: todayStart, $lt: todayEnd }
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
      
      // Record the report attempt for rate limiting
      await recordReportAttempt(deviceId, assetId, req);
      
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
      organizationId: asset.organizationId, // Inherit from asset
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

    const admins = await User.find({ 
      role: { $in: ['super_admin', 'admin', 'manager', 'principal'] }, 
      isActive: true,
      organizationId: asset.organizationId // Only notify users from the same organization
    }).limit(50).select('_id').lean();
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

    // Record the report attempt for rate limiting
    await recordReportAttempt(deviceId, assetId, req);

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

// Import public issues routes
import publicIssuesRouter from './public/issues.js';
router.use('/issues', publicIssuesRouter);

export default router;
