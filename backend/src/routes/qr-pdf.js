import express from 'express';
import { protect } from '../middleware/auth.js';
import { generateAssetQRCodesPDF, generateCategoryQRCodesPDF } from '../services/qrPdfService.js';

const router = express.Router();

router.use(protect);

/**
 * Download QR codes PDF for all assets (grouped by category)
 * GET /api/qr-pdf/download
 */
router.get('/download', async (req, res) => {
  try {
    await generateAssetQRCodesPDF(req.user.organizationId, res);
  } catch (err) {
    console.error('QR PDF download error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || 'Failed to generate PDF' });
    }
  }
});

/**
 * Download QR codes PDF for specific category
 * GET /api/qr-pdf/download/:category
 */
router.get('/download/:category', async (req, res) => {
  try {
    const category = decodeURIComponent(req.params.category);
    await generateCategoryQRCodesPDF(req.user.organizationId, category, res);
  } catch (err) {
    console.error('Category QR PDF download error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || 'Failed to generate PDF' });
    }
  }
});

export default router;

