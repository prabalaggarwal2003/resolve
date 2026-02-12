import express from 'express';
import { protect } from '../middleware/auth.js';
import { Invoice, Vendor } from '../models/index.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';

const router = express.Router();

router.use(protect);

/**
 * Get all invoices
 * GET /api/invoices
 */
router.get('/', async (req, res) => {
  try {
    const { vendorId, status } = req.query;
    const query = { organizationId: req.user.organizationId };

    if (vendorId) query.vendorId = vendorId;
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
      .populate('vendorId', 'vendorId name contactPerson')
      .populate('createdBy', 'name email')
      .sort({ purchaseDate: -1 })
      .lean();

    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Get single invoice
 * GET /api/invoices/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    })
      .populate('vendorId', 'vendorId name contactPerson email phone')
      .populate('createdBy', 'name email')
      .populate('items.assetId', 'assetId name');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Create invoice
 * POST /api/invoices
 */
router.post('/', async (req, res) => {
  try {
    // Check permissions
    if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify vendor exists and belongs to organization
    const vendor = await Vendor.findOne({
      _id: req.body.vendorId,
      organizationId: req.user.organizationId
    });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const invoiceData = {
      ...req.body,
      organizationId: req.user.organizationId,
      createdBy: req.user._id
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    // Log audit
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.INVOICE_CREATED,
      AUDIT_RESOURCES.INVOICE,
      invoice._id,
      {
        resourceName: invoice.invoiceNumber,
        description: `Created invoice: ${invoice.invoiceNumber} for vendor ${vendor.name}`,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          vendorId: vendor.vendorId,
          vendorName: vendor.name,
          totalAmount: invoice.totalAmount,
          status: invoice.status
        },
        severity: 'low',
        organizationId: req.user.organizationId,
        ...getRequestMetadata(req)
      }
    );

    res.status(201).json({ message: 'Invoice created successfully', invoice });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Update invoice
 * PUT /api/invoices/:id
 */
router.put('/:id', async (req, res) => {
  try {
    // Check permissions
    if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const oldInvoice = await Invoice.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!oldInvoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Don't allow changing organizationId
    delete req.body.organizationId;

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    // Log audit
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.INVOICE_UPDATED,
      AUDIT_RESOURCES.INVOICE,
      invoice._id,
      {
        resourceName: invoice.invoiceNumber,
        description: `Updated invoice: ${invoice.invoiceNumber}`,
        details: {
          changes: req.body
        },
        severity: 'low',
        organizationId: req.user.organizationId,
        ...getRequestMetadata(req)
      }
    );

    res.json({ message: 'Invoice updated successfully', invoice });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Delete invoice
 * DELETE /api/invoices/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    // Check permissions
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const invoice = await Invoice.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Log audit
    await logAudit(
      req.user._id,
      AUDIT_ACTIONS.INVOICE_DELETED,
      AUDIT_RESOURCES.INVOICE,
      invoice._id,
      {
        resourceName: invoice.invoiceNumber,
        description: `Deleted invoice: ${invoice.invoiceNumber}`,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount
        },
        severity: 'medium',
        organizationId: req.user.organizationId,
        ...getRequestMetadata(req)
      }
    );

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;

