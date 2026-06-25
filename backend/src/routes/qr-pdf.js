import express from 'express';
import { protect } from '../middleware/auth.js';
import { generateAssetQRCodesPDF, generateCategoryQRCodesPDF } from '../services/qrPdfService.js';
import { logFileDownload, AUDIT_RESOURCES } from '../services/auditService.js';

const router = express.Router();

router.use(protect);

/**
 * Download QR codes PDF for all assets (grouped by category)
 * GET /api/qr-pdf/download
 */
router.get('/download', async (req, res) => {
  const fileName = `asset-qr-codes-${new Date().toISOString().split('T')[0]}.pdf`;
  try {
    await generateAssetQRCodesPDF(req.user.organizationId, res);
    await logFileDownload(req.user._id, req, {
      fileName,
      resource: AUDIT_RESOURCES.ASSET,
      resourceName: 'Asset QR codes PDF',
    });
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
  const category = decodeURIComponent(req.params.category);
  const fileName = `${category}-qr-codes-${new Date().toISOString().split('T')[0]}.pdf`;
  try {
    await generateCategoryQRCodesPDF(req.user.organizationId, category, res);
    await logFileDownload(req.user._id, req, {
      fileName,
      resource: AUDIT_RESOURCES.ASSET,
      resourceName: `${category} QR codes PDF`,
    });
  } catch (err) {
    console.error('Category QR PDF download error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || 'Failed to generate PDF' });
    }
  }
});

export default router;

