import express from 'express';
import { protect } from '../middleware/auth.js';
import { canRead, canWrite } from '../services/permissions.js';
import {
  getAssetGroupBoard,
  createAssetGroup,
  deleteAssetGroup,
  updateTemplateLayout,
  listAssetGroups,
} from '../services/assetGroupService.js';

const router = express.Router();
router.use(protect);

function requireRead(req, res, next) {
  if (!canRead(req.user, 'assets', req)) return res.status(403).json({ message: 'Forbidden' });
  next();
}

function requireWrite(req, res, next) {
  if (!canWrite(req.user, 'assets', req)) return res.status(403).json({ message: 'Forbidden' });
  next();
}

router.get('/', requireRead, async (req, res) => {
  try {
    const groups = await listAssetGroups(req.user.organizationId, req.user._id);
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/board', requireRead, async (req, res) => {
  try {
    const board = await getAssetGroupBoard(req.user.organizationId, req.user._id);
    res.json(board);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireWrite, async (req, res) => {
  try {
    const group = await createAssetGroup(req.user.organizationId, req.user._id, req.body.name);
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', requireWrite, async (req, res) => {
  try {
    const result = await deleteAssetGroup(req.user.organizationId, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/layout', requireWrite, async (req, res) => {
  try {
    const board = await updateTemplateLayout(req.user.organizationId, req.user._id, req.body.assignments);
    res.json(board);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
