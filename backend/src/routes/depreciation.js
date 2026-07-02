import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireTabRead, requireTabWrite } from '../middleware/tabPermissions.js';
import {
  calculateOrganizationDepreciation,
  calculateAssetDepreciation,
  getDepreciationByCategory,
} from '../services/depreciationService.js';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  setAssignment,
  removeAssignment,
  setAssetOverride,
} from '../services/depreciationPolicyService.js';

const router = express.Router();
router.use(protect);

function parseFilters(query) {
  const keys = [
    'method', 'policyId', 'groupId', 'templateId', 'category', 'purchaseYear',
    'departmentId', 'locationId', 'vendorId', 'warrantyStatus', 'fullyDepreciated',
    'replacementPriority', 'purchaseMin', 'purchaseMax', 'bookMin', 'bookMax',
    'depPctMin', 'depPctMax', 'healthMin',
  ];
  const filters = {};
  for (const k of keys) {
    if (query[k] != null && query[k] !== '') filters[k] = query[k];
  }
  return filters;
}

router.get('/summary', requireTabRead('depreciation'), async (req, res) => {
  try {
    const result = await calculateOrganizationDepreciation(
      req.user.organizationId,
      req.user._id,
      parseFilters(req.query)
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/by-category', requireTabRead('depreciation'), async (req, res) => {
  try {
    const result = await getDepreciationByCategory(
      req.user.organizationId,
      req.user._id,
      parseFilters(req.query)
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/asset/:assetId', requireTabRead('depreciation'), async (req, res) => {
  try {
    const depreciation = await calculateAssetDepreciation(
      req.params.assetId,
      req.user.organizationId,
      req.user._id
    );
    res.json(depreciation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/policies', requireTabRead('depreciation'), async (req, res) => {
  try {
    const data = await listPolicies(req.user.organizationId, req.user._id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/policies', requireTabWrite('depreciation'), async (req, res) => {
  try {
    const policy = await createPolicy(req.user.organizationId, req.user._id, req.body);
    res.status(201).json(policy);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/policies/:id', requireTabWrite('depreciation'), async (req, res) => {
  try {
    const policy = await updatePolicy(req.user.organizationId, req.user._id, req.params.id, req.body);
    res.json(policy);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/policies/:id', requireTabWrite('depreciation'), async (req, res) => {
  try {
    const result = await deletePolicy(req.user.organizationId, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/assignments', requireTabWrite('depreciation'), async (req, res) => {
  try {
    const result = await setAssignment(req.user.organizationId, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/assignments/:targetType/:targetRef', requireTabWrite('depreciation'), async (req, res) => {
  try {
    const result = await removeAssignment(
      req.user.organizationId,
      req.params.targetType,
      req.params.targetRef
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/assets/:assetId/override', requireTabWrite('depreciation'), async (req, res) => {
  try {
    const asset = await setAssetOverride(req, req.params.assetId, req.body);
    res.json(asset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
