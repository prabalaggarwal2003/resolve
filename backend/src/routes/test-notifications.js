import express from 'express';
import { protect } from '../middleware/auth.js';
import { checkAssetHealth } from '../services/assetHealthService.js';
import { checkExpiredWarranties, checkExpiringWarranties } from '../services/warrantyChecker.js';

const router = express.Router();

/**
 * Test endpoint to trigger health checks and send notifications
 * POST /api/test-notifications/asset-health/:assetId
 */
router.post('/asset-health/:assetId', protect, async (req, res) => {
  try {
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const healthCheck = await checkAssetHealth(req.params.assetId, req.user._id);

    res.json({
      success: true,
      healthCheck,
      message: 'Health check completed. Notifications sent if thresholds were crossed.'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Test all notification systems
 * POST /api/test-notifications/all
 */
router.post('/all', protect, async (req, res) => {
  try {
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const results = {
      warrantyExpired: await checkExpiredWarranties(),
      warrantyExpiring: await checkExpiringWarranties()
    };

    res.json({
      success: true,
      results,
      message: 'All notification checks completed'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

