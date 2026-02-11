import express from 'express';
import { protect } from '../middleware/auth.js';
import { AuditLog, User } from '../models/index.js';

const router = express.Router();

/**
 * Get audit logs with filtering and pagination
 * GET /api/audit-logs
 */
router.get('/', protect, async (req, res) => {
  try {
    // Only allow admins and managers to view audit logs
    if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      page = 1,
      limit = 50,
      resource,
      action,
      userId,
      severity,
      startDate,
      endDate,
      search
    } = req.query;

    // Build filter query
    const filter = { organizationId: req.user.organizationId };

    if (resource) filter.resource = resource;
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    if (severity) filter.severity = severity;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999); // End of day
        filter.createdAt.$lte = endDateTime;
      }
    }

    // Search in description or resource name
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { resourceName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get logs with user population
    const logs = await AuditLog.find(filter)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await AuditLog.countDocuments(filter);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * Get audit log statistics/summary
 * GET /api/audit-logs/stats
 */
router.get('/stats', protect, async (req, res) => {
  try {
    if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { startDate, endDate } = req.query;
    const filter = { organizationId: req.user.organizationId };

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateTime;
      }
    }

    // Get statistics
    const [
      totalLogs,
      resourceStats,
      actionStats,
      severityStats,
      topUsers
    ] = await Promise.all([
      // Total logs count
      AuditLog.countDocuments(filter),

      // By resource type
      AuditLog.aggregate([
        { $match: filter },
        { $group: { _id: '$resource', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // By action type
      AuditLog.aggregate([
        { $match: filter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // By severity
      AuditLog.aggregate([
        { $match: filter },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Most active users
      AuditLog.aggregate([
        { $match: filter },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { count: 1, 'user.name': 1, 'user.email': 1, 'user.role': 1 } }
      ])
    ]);

    res.json({
      totalLogs,
      resourceStats,
      actionStats,
      severityStats,
      topUsers
    });
  } catch (err) {
    console.error('Get audit stats error:', err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * Export audit logs to CSV
 * GET /api/audit-logs/export
 */
router.get('/export', protect, async (req, res) => {
  try {
    if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      resource,
      action,
      userId,
      severity,
      startDate,
      endDate,
      search,
      format = 'csv'
    } = req.query;

    // Build filter (same as GET endpoint)
    const filter = { organizationId: req.user.organizationId };
    if (resource) filter.resource = resource;
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    if (severity) filter.severity = severity;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateTime;
      }
    }

    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { resourceName: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all matching logs (limit to 10000 for performance)
    const logs = await AuditLog.find(filter)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Timestamp,User,Email,Role,Action,Resource,Resource Name,Description,Severity,IP Address\n';
      const csvRows = logs.map(log => {
        const timestamp = new Date(log.createdAt).toISOString();
        const user = log.userId ? log.userId.name : 'Unknown';
        const email = log.userId ? log.userId.email : 'Unknown';
        const role = log.userId ? log.userId.role : 'Unknown';

        // Escape CSV values
        const escapeCSV = (str) => {
          if (!str) return '';
          return `"${String(str).replace(/"/g, '""')}"`;
        };

        return [
          escapeCSV(timestamp),
          escapeCSV(user),
          escapeCSV(email),
          escapeCSV(role),
          escapeCSV(log.action),
          escapeCSV(log.resource),
          escapeCSV(log.resourceName || ''),
          escapeCSV(log.description || ''),
          escapeCSV(log.severity),
          escapeCSV(log.ipAddress || '')
        ].join(',');
      }).join('\n');

      const csvContent = csvHeader + csvRows;

      // Set headers for file download
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      res.send(csvContent);
    } else {
      // Return JSON format
      res.json({ logs, count: logs.length });
    }
  } catch (err) {
    console.error('Export audit logs error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
