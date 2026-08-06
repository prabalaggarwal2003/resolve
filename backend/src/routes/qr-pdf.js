import express from 'express';
import { protect } from '../middleware/auth.js';
import { generateAssetQRCodesPDF, generateCategoryQRCodesPDF } from '../services/qrPdfService.js';
import { logFileDownload, AUDIT_RESOURCES } from '../services/auditService.js';
import { assetFilterForUser } from '../services/permissions.js';
import { buildAssetListQuery, resolveAssetSort } from '../services/assetQueryService.js';

const router = express.Router();

router.use(protect);

function hasListFilters(query) {
  const keys = [
    'search',
    'status',
    'category',
    'departmentId',
    'groupId',
    'locationIds',
    'locationId',
    'assignedTo',
    'assetIds',
    'filters',
  ];
  return keys.some((k) => {
    const v = query[k];
    return v != null && String(v).trim() !== '';
  });
}

/**
 * Download QR codes PDF for assets (all, or filtered via the same query params as GET /api/assets)
 * GET /api/qr-pdf/download
 */
router.get('/download', async (req, res) => {
  const filtered = hasListFilters(req.query) || req.query.filtered === '1' || req.query.filtered === 'true';
  const fileName = filtered
    ? `asset-qr-codes-filtered-${new Date().toISOString().split('T')[0]}.pdf`
    : `asset-qr-codes-${new Date().toISOString().split('T')[0]}.pdf`;
  try {
    let filter;
    let sort;
    if (filtered) {
      const baseFilter = assetFilterForUser(req.user);
      filter = await buildAssetListQuery(baseFilter, req.query);
      const { sort: sortKey = 'category', order = 'asc' } = req.query;
      sort = resolveAssetSort(sortKey, order);
      // Keep category grouping stable when user sorts by another field
      if (!sort.category) {
        sort = { ...sort, category: 1 };
      }
    } else {
      filter = { organizationId: req.user.organizationId };
      sort = { category: 1, assetId: 1 };
    }

    await generateAssetQRCodesPDF(req.user.organizationId, res, { filter, sort });
    await logFileDownload(req.user._id, req, {
      fileName,
      resource: AUDIT_RESOURCES.ASSET,
      resourceName: filtered ? 'Filtered asset QR codes PDF' : 'Asset QR codes PDF',
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
