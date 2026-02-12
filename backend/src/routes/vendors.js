import express from 'express';
import { protect } from '../middleware/auth.js';
import { Vendor, Invoice, Asset } from '../models/index.js';
import { generateVendorId } from '../services/vendorIdGenerator.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';

const router = express.Router();

router.use(protect);

/**
 * Get all vendors for organization
 * GET /api/vendors
 */
router.get('/', async (req, res) => {
  try {
    const { status, category, search } = req.query;
    const query = { organizationId: req.user.organizationId };

    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { vendorId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const vendors = await Vendor.find(query)
      .populate('createdBy', 'name email')
      .sort({ name: 1 })
      .lean();

    // Get counts for each vendor
    const vendorsWithCounts = await Promise.all(
      vendors.map(async (vendor) => {
        const [assetCount, invoiceCount, invoiceStats] = await Promise.all([
          Asset.countDocuments({
            vendorId: vendor._id,
            organizationId: req.user.organizationId
          }),
          Invoice.countDocuments({
            vendorId: vendor._id,
            organizationId: req.user.organizationId
          }),
          Invoice.aggregate([
            {
              $match: {
                vendorId: vendor._id,
                organizationId: req.user.organizationId
              }
            },
            {
              $group: {
                _id: null,
                totalPurchased: { $sum: '$totalAmount' },
                totalPaid: { $sum: '$paidAmount' }
              }
            }
          ])
        ]);

        return {
          ...vendor,
          assetCount,
          invoiceCount,
          totalPurchased: invoiceStats[0]?.totalPurchased || 0,
          totalPaid: invoiceStats[0]?.totalPaid || 0,
          pendingPayment: (invoiceStats[0]?.totalPurchased || 0) - (invoiceStats[0]?.totalPaid || 0)
        };
      })
    );

    res.json(vendorsWithCounts);
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Get single vendor with details
 * GET /api/vendors/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).populate('createdBy', 'name email');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Get related data
    const [assets, invoices] = await Promise.all([
      Asset.find({ vendorId: vendor._id })
        .populate('locationId', 'name path')
        .populate('departmentId', 'name')
        .select('assetId name cost category status purchaseDate')
        .sort({ purchaseDate: -1 })
        .lean(),
      Invoice.find({ vendorId: vendor._id })
        .sort({ purchaseDate: -1 })
        .lean()
    ]);

    const stats = {
      totalAssets: assets.length,
      totalInvoices: invoices.length,
      totalPurchased: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      totalPaid: invoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
      pendingPayment: invoices
        .filter(inv => inv.status !== 'Paid')
        .reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0)
    };

    res.json({ vendor, assets, invoices, stats });
  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Create vendor
 * POST /api/vendors
 */
router.post('/', async (req, res) => {
  try {
    // Check permissions
    if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate unique vendor ID
    const vendorId = await generateVendorId(req.user.organizationId);

    const vendorData = {
      ...req.body,
      vendorId,
      organizationId: req.user.organizationId,
      createdBy: req.user._id
    };

    const vendor = new Vendor(vendorData);
    await vendor.save();

    // Log audit
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.VENDOR_CREATED,
      AUDIT_RESOURCES.VENDOR,
      vendor._id,
      {
        resourceName: `${vendor.vendorId} - ${vendor.name}`,
        description: `Created vendor: ${vendor.name}`,
        details: {
          vendorId: vendor.vendorId,
          name: vendor.name,
          category: vendor.category,
          status: vendor.status
        },
        severity: 'low',
        organizationId: req.user.organizationId,
        ...getRequestMetadata(req)
      }
    );

    res.status(201).json({ message: 'Vendor created successfully', vendor });
  } catch (error) {
    console.error('Create vendor error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Vendor ID already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Update vendor
 * PUT /api/vendors/:id
 */
router.put('/:id', async (req, res) => {
  try {
    // Check permissions
    if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const oldVendor = await Vendor.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!oldVendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Don't allow changing vendorId or organizationId
    delete req.body.vendorId;
    delete req.body.organizationId;

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    // Log audit
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.VENDOR_UPDATED,
      AUDIT_RESOURCES.VENDOR,
      vendor._id,
      {
        resourceName: `${vendor.vendorId} - ${vendor.name}`,
        description: `Updated vendor: ${vendor.name}`,
        details: {
          changes: req.body
        },
        severity: 'low',
        organizationId: req.user.organizationId,
        ...getRequestMetadata(req)
      }
    );

    res.json({ message: 'Vendor updated successfully', vendor });
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Delete vendor
 * DELETE /api/vendors/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    // Check permissions
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if vendor has associated assets
    const assetCount = await Asset.countDocuments({
      vendorId: req.params.id,
      organizationId: req.user.organizationId
    });

    if (assetCount > 0) {
      return res.status(400).json({
        message: `Cannot delete vendor. ${assetCount} asset(s) are associated with this vendor. Please reassign or remove the assets first.`
      });
    }

    const vendor = await Vendor.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Delete associated invoices
    await Invoice.deleteMany({ vendorId: req.params.id });

    // Log audit
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.VENDOR_DELETED,
      AUDIT_RESOURCES.VENDOR,
      vendor._id,
      {
        resourceName: `${vendor.vendorId} - ${vendor.name}`,
        description: `Deleted vendor: ${vendor.name}`,
        details: {
          vendorId: vendor.vendorId,
          name: vendor.name
        },
        severity: 'medium',
        organizationId: req.user.organizationId,
        ...getRequestMetadata(req)
      }
    );

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;

