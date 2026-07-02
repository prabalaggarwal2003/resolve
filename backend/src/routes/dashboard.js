import express from 'express';
import { Asset, Issue } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canReportOnly, isLabTechnician, assetFilterForUser, issueFilterForUser, getDepartmentScopeId, resolveScopedAssetIds } from '../services/permissions.js';
import { getDashboardOverview } from '../services/dashboardOverviewService.js';

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

    let assetFilter = assetFilterForUser(req.user) || { _id: { $exists: false } };

    let deptAssetIds = null;
    const deptScope = getDepartmentScopeId(req.user);
    const locationScoped = isLabTechnician(req.user) && req.user.assignedLocationIds?.length;
    if (deptScope || locationScoped) {
      deptAssetIds = await resolveScopedAssetIds(req.user);
    }

    const baseIssueFilter = issueFilterForUser(req.user, deptAssetIds) || { _id: { $exists: false } };

    const [totalAssets, openIssues, inProgressIssues, completedToday, myAssets, myReports, pendingReports, underMaintenance] = await Promise.all([
      Asset.countDocuments(assetFilter),
      Issue.countDocuments({ ...baseIssueFilter, status: 'open' }),
      Issue.countDocuments({ ...baseIssueFilter, status: 'in_progress' }),
      Issue.countDocuments({ ...baseIssueFilter, status: 'completed', resolvedAt: { $gte: todayStart } }),
      canReportOnly(req.user) ? Asset.countDocuments({ ...assetFilter, assignedTo: userId }) : Asset.countDocuments(assetFilter),
      Issue.countDocuments({ ...baseIssueFilter, $or: [{ reportedBy: userId }, { reporterEmail: userEmail }] }),
      Issue.countDocuments({ ...baseIssueFilter, status: { $in: ['open', 'in_progress'] } }),
      Asset.countDocuments({ ...assetFilter, status: 'under_maintenance' }),
    ]);

    res.json({
      totalAssets,
      openIssues,
      inProgressIssues,
      completedToday,
      myAssets: myAssets ?? 0,
      myReports: myReports ?? 0,
      pendingReports: pendingReports ?? 0,
      underMaintenance: underMaintenance ?? 0,
      role: req.user.role || 'unknown',
      canReportOnly: canReportOnly(req.user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const overview = await getDashboardOverview(req.user);
    res.json(overview);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
