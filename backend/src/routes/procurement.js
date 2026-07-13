import express from 'express';
import { protect } from '../middleware/auth.js';
import { canRead, canWrite } from '../services/permissions.js';
import {
  listProcurements,
  getProcurementById,
  createProcurement,
  updateProcurement,
  deleteProcurement,
  linkAssetToProcurement,
  getProcurementSummary,
} from '../services/procurementService.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';
import { changesToAuditPayload } from '../services/budgetChangeLog.js';

const router = express.Router();

router.use(protect);

function requireBudgetRead(req, res, next) {
  if (!canRead(req.user, 'budgets', req)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

function requireBudgetWrite(req, res, next) {
  if (!canWrite(req.user, 'budgets', req)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

router.get('/summary', requireBudgetRead, async (req, res) => {
  try {
    const summary = await getProcurementSummary(req.user.organizationId);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', requireBudgetRead, async (req, res) => {
  try {
    const procurements = await listProcurements(req.user.organizationId, { ...req.query });
    res.json({ procurements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', requireBudgetRead, async (req, res) => {
  try {
    const procurement = await getProcurementById(req.user.organizationId, req.params.id);
    if (!procurement) return res.status(404).json({ message: 'Procurement record not found' });
    res.json({ procurement });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireBudgetWrite, async (req, res) => {
  try {
    const procurement = await createProcurement(req.user.organizationId, req.user, req.body);
    await logAudit(req.user._id, AUDIT_ACTIONS.PROCUREMENT_CREATED, AUDIT_RESOURCES.PROCUREMENT, procurement._id, {
      resourceName: procurement.purchaseId,
      description: `Created procurement ${procurement.purchaseId}`,
      severity: 'medium',
      ...getRequestMetadata(req),
    });
    res.status(201).json({ procurement });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

router.put('/:id', requireBudgetWrite, async (req, res) => {
  try {
    const { procurement, changes } = await updateProcurement(req.user.organizationId, req.user, req.params.id, req.body);
    const auditPayload = changes?.length ? changesToAuditPayload(changes) : null;
    await logAudit(req.user._id, AUDIT_ACTIONS.PROCUREMENT_UPDATED, AUDIT_RESOURCES.PROCUREMENT, procurement._id, {
      resourceName: procurement.purchaseId,
      description: auditPayload?.summary || `Updated procurement ${procurement.purchaseId}`,
      details: auditPayload || undefined,
      severity: 'medium',
      ...getRequestMetadata(req),
    });
    res.json({ procurement, changes: changes || [] });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

router.delete('/:id', requireBudgetWrite, async (req, res) => {
  try {
    const procurement = await deleteProcurement(req.user.organizationId, req.user, req.params.id);
    await logAudit(req.user._id, AUDIT_ACTIONS.PROCUREMENT_DELETED, AUDIT_RESOURCES.PROCUREMENT, procurement._id, {
      resourceName: procurement.purchaseId,
      description: `Deleted procurement ${procurement.purchaseId}`,
      severity: 'high',
      ...getRequestMetadata(req),
    });
    res.json({ message: 'Procurement deleted' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

router.post('/:id/link-asset', requireBudgetWrite, async (req, res) => {
  try {
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ message: 'assetId is required' });
    const procurement = await linkAssetToProcurement(
      req.user.organizationId,
      req.user,
      req.params.id,
      assetId
    );
    await logAudit(req.user._id, AUDIT_ACTIONS.PROCUREMENT_LINKED, AUDIT_RESOURCES.PROCUREMENT, procurement._id, {
      resourceName: procurement.purchaseId,
      description: `Linked asset to procurement ${procurement.purchaseId}`,
      details: { assetId },
      severity: 'medium',
      ...getRequestMetadata(req),
    });
    res.json({ procurement });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

export default router;
