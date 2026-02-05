import express from 'express';
import { Asset, Issue } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canViewAll, canReportOnly, isHod, isLabTechnician, assetFilterForUser, issueFilterForUser } from '../services/permissions.js';

const router = express.Router();

router.use(protect);

/**
 * Summary counts for dashboard cards. Role-based: principal/super_admin see all; HOD/lab_technician see their scope; teacher/student see my reports.
 */
router.get('/summary', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const userId = req.user._id;
    const userEmail = req.user.email?.toLowerCase();
    const assetFilter = assetFilterForUser(req.user) || { _id: { $exists: false } };
    // Build issue filter using shared helper to ensure org scoping
    let roleAssetIds = null;
    if (isHod(req.user) && req.user.departmentId) {
      const assets = await Asset.find({ departmentId: req.user.departmentId }).select('_id').lean();
      roleAssetIds = assets.map((a) => a._id);
    } else if (isLabTechnician(req.user) && req.user.assignedLocationIds?.length) {
      const assets = await Asset.find({ locationId: { $in: req.user.assignedLocationIds } }).select('_id').lean();
      roleAssetIds = assets.map((a) => a._id);
    }
    const baseIssueFilter = issueFilterForUser(req.user, roleAssetIds) || { _id: { $exists: false } };
    const [totalAssets, openIssues, inProgressIssues, completedToday, myAssets, myReports, pendingReports] = await Promise.all([
      Asset.countDocuments(assetFilter),
      Issue.countDocuments({ ...baseIssueFilter, status: 'open' }),
      Issue.countDocuments({ ...baseIssueFilter, status: 'in_progress' }),
      Issue.countDocuments({ ...baseIssueFilter, status: 'completed', resolvedAt: { $gte: todayStart } }),
      canReportOnly(req.user) ? Asset.countDocuments({ ...assetFilter, assignedTo: userId }) : Asset.countDocuments(assetFilter),
      Issue.countDocuments({ ...baseIssueFilter, $or: [{ reportedBy: userId }, { reporterEmail: userEmail }] }),
      Issue.countDocuments({ ...baseIssueFilter, status: { $in: ['open', 'in_progress'] } }),
    ]);
    res.json({
      totalAssets,
      openIssues,
      inProgressIssues,
      completedToday,
      myAssets: myAssets ?? 0,
      myReports: myReports ?? 0,
      pendingReports: pendingReports ?? 0,
      role: req.user.role || 'reporter',
      canReportOnly: canReportOnly(req.user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
