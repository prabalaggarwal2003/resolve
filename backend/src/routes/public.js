import express from 'express';
import { Asset, Issue, Notification, User, AssetTemplate, Organization } from '../models/index.js';
import { generateTicketId } from '../services/ticketId.js';
import { getDeviceFingerprint, canReport, recordReportAttempt } from '../utils/rateLimiter.js';
import { getQrVisibilityFromTemplate } from '../services/assetTemplateService.js';

const router = express.Router();

const FALLBACK_QR_FIELD_KEYS = [
  'name',
  'model',
  'serialNumber',
  'status',
  'condition',
  'assignedToName',
  'assignedToEmployeeCode',
  'locationId',
  'departmentId',
  'purchaseDate',
  'warrantyExpiry',
  'amcExpiry',
  'nextMaintenanceDate',
  'vendorId',
  'cost',
];

/**
 * Public asset by ID — no auth. Used when someone scans the asset QR code.
 * Field visibility is driven by the asset's template (qrSections + field.qrVisible).
 */
router.get('/assets/:id', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('locationId', 'name path type code')
      .populate('departmentId', 'name')
      .populate('vendorId', 'name')
      .select(
        'name assetId category model serialNumber status condition tags customFields templateId organizationId maintenanceReason maintenanceStartDate maintenanceCompletedDate maintenanceHistory purchaseDate vendorId cost warrantyExpiry amcExpiry nextMaintenanceDate photos documents locationId departmentId assignedToName assignedToEmployeeCode'
      )
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    let template = null;
    if (asset.templateId) {
      template = await AssetTemplate.findById(asset.templateId).lean();
    }
    if (!template && asset.category) {
      template = await AssetTemplate.findOne({
        organizationId: asset.organizationId,
        name: asset.category,
      }).lean();
    }

    const { qrSections, visibleFields } = getQrVisibilityFromTemplate(
      template || {
        fields: FALLBACK_QR_FIELD_KEYS.map((key) => ({
          key,
          label: key,
          section:
            ['assignedToName', 'assignedToEmployeeCode', 'locationId', 'departmentId'].includes(key)
              ? 'assignment'
              : ['purchaseDate', 'warrantyExpiry', 'amcExpiry', 'nextMaintenanceDate', 'vendorId', 'cost'].includes(key)
              ? 'purchase'
              : 'basic',
          builtIn: true,
          qrVisible: true,
        })),
        qrSections: {
          basic: true,
          assignment: true,
          purchase: true,
          custom: true,
          photos: true,
          documents: true,
          maintenance: true,
          issues: true,
        },
      }
    );

    const visibleKeySet = new Set(visibleFields.map((f) => f.key));
    // Always keep identity header fields
    ['name', 'assetId', 'category', 'status'].forEach((k) => visibleKeySet.add(k));

    const customFields = {};
    if (asset.customFields && typeof asset.customFields === 'object') {
      for (const [key, value] of Object.entries(asset.customFields)) {
        if (visibleKeySet.has(key)) customFields[key] = value;
      }
    }

    const org = asset.organizationId
      ? await Organization.findById(asset.organizationId).select('currency timezone').lean()
      : null;

    const publicAsset = {
      _id: asset._id,
      name: asset.name,
      assetId: asset.assetId,
      category: asset.category,
      status: asset.status,
      currency: org?.currency || 'INR',
      timezone: org?.timezone || 'Asia/Kolkata',
      model: visibleKeySet.has('model') ? asset.model : undefined,
      serialNumber: visibleKeySet.has('serialNumber') ? asset.serialNumber : undefined,
      condition: visibleKeySet.has('condition') ? asset.condition : undefined,
      tags: visibleKeySet.has('tags') ? asset.tags : undefined,
      assignedToName: visibleKeySet.has('assignedToName') ? asset.assignedToName : undefined,
      assignedToEmployeeCode: visibleKeySet.has('assignedToEmployeeCode')
        ? asset.assignedToEmployeeCode
        : undefined,
      locationId: visibleKeySet.has('locationId') ? asset.locationId : undefined,
      departmentId: visibleKeySet.has('departmentId') ? asset.departmentId : undefined,
      purchaseDate: visibleKeySet.has('purchaseDate') ? asset.purchaseDate : undefined,
      warrantyExpiry: visibleKeySet.has('warrantyExpiry') ? asset.warrantyExpiry : undefined,
      amcExpiry: visibleKeySet.has('amcExpiry') ? asset.amcExpiry : undefined,
      nextMaintenanceDate: visibleKeySet.has('nextMaintenanceDate') ? asset.nextMaintenanceDate : undefined,
      cost: visibleKeySet.has('cost') ? asset.cost : undefined,
      vendorId: visibleKeySet.has('vendorId') ? asset.vendorId : undefined,
      vendor: visibleKeySet.has('vendorId') && asset.vendorId?.name ? asset.vendorId.name : undefined,
      customFields: Object.keys(customFields).length ? customFields : undefined,
      photos: qrSections.photos ? asset.photos : [],
      documents: qrSections.documents ? asset.documents : [],
      maintenanceReason: qrSections.maintenance ? asset.maintenanceReason : undefined,
      maintenanceStartDate: qrSections.maintenance ? asset.maintenanceStartDate : undefined,
      maintenanceCompletedDate: qrSections.maintenance ? asset.maintenanceCompletedDate : undefined,
      maintenanceHistory: qrSections.maintenance ? asset.maintenanceHistory : [],
      qrView: {
        sections: qrSections,
        fields: visibleFields,
      },
    };

    let previousIssues = [];
    if (qrSections.issues) {
      const issues = await Issue.find({ assetId: req.params.id })
        .select('ticketId title description status createdAt reports')
        .populate('reports', 'reporterName reporterEmail createdAt')
        .sort({ createdAt: -1 })
        .lean();

      previousIssues = issues.map((issue) => ({
        ticketId: issue.ticketId,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        createdAt: issue.createdAt,
        reports: (issue.reports || []).map((report) => ({
          reporterName: report.reporterName,
          reporterEmail: report.reporterEmail,
          createdAt: report.createdAt,
        })),
      }));
    }

    publicAsset.previousIssues = previousIssues;

    res.json(publicAsset);
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
      .select(
        'name assetId category model serialNumber status condition maintenanceReason maintenanceStartDate maintenanceCompletedDate maintenanceHistory purchaseDate vendor cost warrantyExpiry amcExpiry nextMaintenanceDate photos documents locationId departmentId assignedToName assignedToEmployeeCode'
      )
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
    // IMPORTANT: Filter by organizationId to prevent cross-org leaks
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const existing = await Issue.findOne({
      assetId,
      organizationId: asset.organizationId, // Filter by organization
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
