import express from 'express';
import { protect } from '../middleware/auth.js';
import { Asset } from '../models/index.js';
import {
  checkAssetHealth,
  runOrganizationHealthCheck,
  getAssetHealthSummary,
  getAssetsUnderMaintenance,
  checkOverdueMaintenanceAlerts,
  sendMaintenanceNotification,
  HEALTH_THRESHOLDS,
  ASSET_CONDITIONS
} from '../services/assetHealthService.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';

const router = express.Router();

router.use(protect);

// Helper function to check admin/manager roles
function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
}

/**
 * Get asset health summary for organization
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await getAssetHealthSummary(req.user.organizationId);
    const thresholds = HEALTH_THRESHOLDS;
    const conditions = ASSET_CONDITIONS;

    res.json({ summary, thresholds, conditions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get all assets under maintenance
 */
router.get('/maintenance', async (req, res) => {
  try {
    const assets = await getAssetsUnderMaintenance(req.user.organizationId);
    res.json({ assets, total: assets.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * Check for overdue maintenance alerts (manual trigger)
 */
router.post('/maintenance/check-overdue', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const result = await checkOverdueMaintenanceAlerts();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * Check health for a specific asset
 */
router.post('/check/:assetId', requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
  try {
    const healthAnalysis = await checkAssetHealth(req.params.assetId, req.user._id);
    if (!healthAnalysis) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    res.json(healthAnalysis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * Run health check for all assets in organization
 */
router.post('/check-all', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const results = await runOrganizationHealthCheck(req.user.organizationId, req.user._id);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * Update asset maintenance status manually
 */
router.patch('/:assetId/maintenance', requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
  try {
    const { status, reason } = req.body;

    if (!['start', 'complete'].includes(status)) {
      return res.status(400).json({ message: 'Status must be "start" or "complete"' });
    }

    // Fetch current asset first so we can access maintenanceStartDate and history
    const currentAsset = await Asset.findById(req.params.assetId);
    if (!currentAsset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const now = new Date();
    let updateQuery = {};

    if (status === 'start') {
      updateQuery = {
        $set: {
          condition: 'under_maintenance',
          status: 'under_maintenance',
          maintenanceReason: reason || 'Manual maintenance request',
          maintenanceStartDate: now,
          lastHealthCheck: now,
        },
        $push: {
          maintenanceHistory: {
            startDate: now,
            reason: reason || 'Manual maintenance request'
          }
        }
      };
    } else {
      // Calculate duration in minutes from when maintenance started
      const startDate = currentAsset.maintenanceStartDate;
      const durationMinutes = startDate
        ? Math.round((now - new Date(startDate)) / 60000)
        : null;

      // Find the last open (no endDate) history entry index
      const history = currentAsset.maintenanceHistory || [];
      const lastIdx = history.length - 1;
      const hasOpenEntry = lastIdx >= 0 && !history[lastIdx].endDate;

      const setFields = {
        condition: 'good',
        status: 'available',
        maintenanceReason: null,
        maintenanceStartDate: null,
        maintenanceCompletedDate: now,
        lastHealthCheck: now,
      };

      // Close the last open history entry using positional dot notation
      if (hasOpenEntry) {
        setFields[`maintenanceHistory.${lastIdx}.endDate`] = now;
        setFields[`maintenanceHistory.${lastIdx}.completedBy`] = req.user._id;
        if (durationMinutes !== null) {
          setFields[`maintenanceHistory.${lastIdx}.durationMinutes`] = durationMinutes;
        }
      }

      updateQuery = { $set: setFields };
    }

    const asset = await Asset.findByIdAndUpdate(
      req.params.assetId,
      updateQuery,
      { new: true }
    );

    // Send notification if starting maintenance
    if (status === 'start') {
      await sendMaintenanceNotification(asset, reason || 'Manual maintenance request');
    }

    // Log audit entry
    await logAudit(req.user._id, AUDIT_ACTIONS.ASSET_UPDATED, AUDIT_RESOURCES.ASSET, asset._id, {
      resourceName: `${asset.assetId} - ${asset.name}`,
      description: `Manual ${status === 'start' ? 'started' : 'completed'} maintenance`,
      details: { maintenanceAction: status, reason, manual: true },
      severity: 'medium',
      ...getRequestMetadata(req)
    });

    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
