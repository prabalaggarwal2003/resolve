import express from 'express';
import { protect } from '../middleware/auth.js';
import { getOrganizationKPIs } from '../services/kpiService.js';

const router = express.Router();

router.use(protect);

/**
 * Get organization KPIs and metrics
 * GET /api/kpis
 */
router.get('/', async (req, res) => {
  try {
    const kpis = await getOrganizationKPIs(req.user.organizationId);
    res.json(kpis);
  } catch (error) {
    console.error('KPI fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;

