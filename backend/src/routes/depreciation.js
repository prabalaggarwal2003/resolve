import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  calculateAssetDepreciation,
  calculateOrganizationDepreciation,
  getDepreciationByCategory,
  DEPRECIATION_CONFIG
} from '../services/depreciationService.js';

const router = express.Router();

router.use(protect);

/**
 * Get depreciation summary for organization
 * GET /api/depreciation/summary
 */
router.get('/summary', async (req, res) => {
  try {
    const result = await calculateOrganizationDepreciation(req.user.organizationId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get depreciation by category
 * GET /api/depreciation/by-category
 */
router.get('/by-category', async (req, res) => {
  try {
    const result = await getDepreciationByCategory(req.user.organizationId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get depreciation for specific asset
 * GET /api/depreciation/asset/:assetId
 */
router.get('/asset/:assetId', async (req, res) => {
  try {
    const depreciation = await calculateAssetDepreciation(req.params.assetId);
    res.json(depreciation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get depreciation configuration
 * GET /api/depreciation/config
 */
router.get('/config', async (req, res) => {
  try {
    res.json({ config: DEPRECIATION_CONFIG });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

