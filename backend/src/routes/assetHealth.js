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

    const updateData = {
      lastHealthCheck: new Date()
    };

    if (status === 'start') {
      updateData.condition = 'under_maintenance';
      updateData.status = 'under_maintenance';
      updateData.maintenanceReason = reason || 'Manual maintenance request';
      updateData.maintenanceStartDate = new Date();
    } else {
      updateData.condition = 'good';
      updateData.status = 'available';
      updateData.maintenanceReason = null;
      updateData.maintenanceStartDate = null;
      updateData.maintenanceCompletedDate = new Date();
    }

    const asset = await Asset.findByIdAndUpdate(
      req.params.assetId,
      updateData,
      { new: true }
    );

    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    // Send notification if starting maintenance
    if (status === 'start') {
      await sendMaintenanceNotification(asset, reason || 'Manual maintenance request');
    }

    // Log audit entry
    await logAudit(req.user._id, AUDIT_ACTIONS.ASSET_UPDATED, AUDIT_RESOURCES.ASSET, asset._id, {
      resourceName: `${asset.assetId} - ${asset.name}`,
      description: `Manual ${status === 'start' ? 'started' : 'completed'} maintenance`,
      details: {
        maintenanceAction: status,
        reason: reason,
        manual: true
      },
      severity: 'medium',
      ...getRequestMetadata(req)
    });

    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
