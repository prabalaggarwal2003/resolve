import express from 'express';
import { Issue, Notification, User, Asset } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { issueFilterForUser, canEdit, canViewAll, isHod, isLabTechnician, assignIssueToUsers } from '../services/permissions.js';
import { generateTicketId } from '../services/ticketId.js';

const router = express.Router();

router.use(protect);

// Helper function to format assigned to list
function formatAssignedToList(assignedTo) {
  if (!assignedTo) return [];
  
  if (Array.isArray(assignedTo)) {
    return assignedTo.map(person => ({
      name: person.name,
      email: person.email,
      role: person.role,
      displayText: `${person.name} (${person.role})`
    }));
  }
  
  return [{
    name: assignedTo.name,
    email: assignedTo.email,
    role: assignedTo.role,
    displayText: `${assignedTo.name} (${assignedTo.role})`
  }];
}

/**
 * List issues. Query: assetId, status, myReports (true = only issues I reported).
 * Role-based: HOD sees department issues, lab_technician sees their lab issues, teacher/student see own reports.
 */
router.get('/', async (req, res) => {
  try {
    const { assetId, status, myReports, page = 1, limit = 50 } = req.query;
    let filter = {};
    if (assetId) filter.assetId = assetId;
    if (status) filter.status = status;
    if (myReports === 'true' || myReports === true) {
      filter.$or = [
        { reportedBy: req.user._id },
        { reporterEmail: req.user.email?.toLowerCase() },
      ];
    } else {
      let roleAssetIds = null;
      if (isHod(req.user) && req.user.departmentId) {
        const assets = await Asset.find({ departmentId: req.user.departmentId }).select('_id').lean();
        roleAssetIds = assets.map((a) => a._id);
      } else if (isLabTechnician(req.user) && req.user.assignedLocationIds?.length) {
        const assets = await Asset.find({ locationId: { $in: req.user.assignedLocationIds } }).select('_id').lean();
        roleAssetIds = assets.map((a) => a._id);
      }
      const roleFilter = issueFilterForUser(req.user, roleAssetIds);
      if (roleFilter && Object.keys(roleFilter).length) {
        filter = { ...filter, ...roleFilter };
      }
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .populate({
          path: 'assetId',
          select: 'name assetId category departmentId locationId assignedTo',
          populate: { path: 'assignedTo', select: 'name email' },
        })
        .populate('assignedTo', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Issue.countDocuments(filter),
    ]);
    
    // Format each issue for better frontend display
    const formattedIssues = issues.map(issue => ({
      ...issue,
      assetLinkText: issue.assetId?.assetId || 'Unknown',
      assignedToList: formatAssignedToList(issue.assignedTo),
      categoryLabel: `Category: ${issue.category || 'Not specified'}`,
    }));
    
    res.json({ issues: formattedIssues, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Get one issue by id.
 */
router.get('/:id', async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate({
        path: 'assetId',
        select: 'name assetId category locationId assignedTo departmentId',
        populate: { path: 'assignedTo', select: 'name email' },
      })
      .populate('assignedTo', 'name email role')
      .populate('locationId', 'name path')
      .lean();
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    
    // Check access permissions
    if (!canViewAll(req.user)) {
      // HOD: can only view issues from their department
      if (isHod(req.user) && req.user.departmentId) {
        const assetDeptId = issue.assetId?.departmentId?._id?.toString() ?? issue.assetId?.departmentId?.toString();
        if (assetDeptId !== req.user.departmentId?.toString()) {
          return res.status(403).json({ message: 'You do not have access to this issue' });
        }
      }
      // Lab technician: can only view issues from their assigned locations
      else if (isLabTechnician(req.user) && req.user.assignedLocationIds?.length) {
        const assetLocId = issue.assetId?.locationId?._id?.toString() ?? issue.assetId?.locationId?.toString();
        if (!req.user.assignedLocationIds.some(id => id?.toString() === assetLocId)) {
          return res.status(403).json({ message: 'You do not have access to this issue' });
        }
      }
      // Report only roles: can only view their own reports
      else if (canReportOnly(req.user)) {
        const isReporter = issue.reportedBy?.toString() === req.user._id?.toString() || 
                          issue.reporterEmail?.toLowerCase() === req.user.email?.toLowerCase();
        if (!isReporter) {
          return res.status(403).json({ message: 'You do not have access to this issue' });
        }
      }
    }
    
    // Format the response for better frontend display
    const formattedIssue = {
      ...issue,
      // Asset link text should show asset ID
      assetLinkText: issue.assetId?.assetId || 'Unknown',
      // Format assigned to as a neat list
      assignedToList: formatAssignedToList(issue.assignedTo),
      // Format category with label
      categoryLabel: `Category: ${issue.category || 'Not specified'}`,
    };
    
    res.json(formattedIssue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const ALLOWED_STATUSES = ['in_progress', 'completed', 'cancelled'];

/**
 * Update issue status (in progress, completed, cancelled). Requires edit permission and excludes principal/HOD.
 */
router.patch('/:id', (req, res, next) => {
  if (!canEdit(req.user) || isHod(req.user) || req.user.role === 'principal') {
    return res.status(403).json({ message: 'You do not have permission to update issues' });
  }
  next();
}, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status. Use: in_progress, completed, cancelled',
      });
    }
    const prev = await Issue.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ message: 'Issue not found' });
    const update = { status };
    if (status === 'completed') {
      update.resolvedAt = new Date();
      update.resolvedBy = req.user._id;
    }
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    )
      .populate('assetId', 'name assetId category')
      .populate('assignedTo', 'name email')
      .lean();
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    await logAudit(req.user._id, 'issue.updated', 'issue', issue._id, { status: issue.status });
    const managers = await User.find({ role: { $in: ['super_admin', 'admin', 'manager', 'principal'] }, isActive: true }).limit(50).select('_id').lean();
    const notif = {
      type: status === 'completed' ? 'report_resolved' : 'report_updated',
      title: status === 'completed' ? 'Report resolved' : 'Report updated',
      body: `${issue.ticketId} → ${status.replace('_', ' ')}`,
      link: `/dashboard/issues/${issue._id}`,
      metadata: { issueId: issue._id },
    };
    await Notification.insertMany(managers.map((u) => ({ ...notif, userId: u._id })));
    res.json(issue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Create new issue with automatic assignment to superadmin and lab technicians
 */
router.post('/', async (req, res) => {
  try {
    const { assetId, title, description, category, priority, photos } = req.body;
    
    if (!assetId || !title) {
      return res.status(400).json({ message: 'Asset ID and title are required' });
    }
    
    // Get asset to determine department
    const asset = await Asset.findById(assetId).select('departmentId').lean();
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    
    // Create issue
    const ticketId = await generateTicketId();
    const issueData = {
      ticketId,
      assetId,
      title,
      description,
      category: category || 'repair',
      priority: priority || 'medium',
      photos: photos || [],
      reportedBy: req.user._id,
      reporterName: req.user.name,
      reporterEmail: req.user.email,
      reporterPhone: req.user.phone,
    };
    
    const issue = await Issue.create(issueData);
    
    // Assign to superadmin and lab technicians
    await assignIssueToUsers(issue._id, asset.departmentId);
    
    await logAudit(req.user._id, 'issue.created', 'issue', issue._id, { 
      ticketId, 
      assetId, 
      title 
    });
    
    const populated = await Issue.findById(issue._id)
      .populate({
        path: 'assetId',
        select: 'name assetId category departmentId locationId assignedTo',
        populate: { path: 'assignedTo', select: 'name email' },
      })
      .populate('assignedTo', 'name email role')
      .lean();
    
    // Format the response for better frontend display
    const formattedIssue = {
      ...populated,
      assetLinkText: populated.assetId?.assetId || 'Unknown',
      assignedToList: formatAssignedToList(populated.assignedTo),
      categoryLabel: `Category: ${populated.category || 'Not specified'}`,
    };
    
    res.status(201).json(formattedIssue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
