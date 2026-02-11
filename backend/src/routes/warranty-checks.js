import express from 'express';
import { protect } from '../middleware/auth.js';
import { checkExpiredWarranties, checkExpiringWarranties } from '../services/warrantyChecker.js';

const router = express.Router();

/**
 * Manually trigger warranty expiry check
 * GET /api/warranty-checks/expired
 */
router.get('/expired', protect, async (req, res) => {
  try {
    // Only allow admins to manually trigger
    if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await checkExpiredWarranties();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Manually trigger expiring soon check
 * GET /api/warranty-checks/expiring-soon
 */
router.get('/expiring-soon', protect, async (req, res) => {
  try {
    // Only allow admins to manually trigger
    if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await checkExpiringWarranties();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

