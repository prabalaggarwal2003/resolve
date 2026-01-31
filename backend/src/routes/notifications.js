import express from 'express';
import { Notification } from '../models/index.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { limit = 30, unreadOnly } = req.query;
    const filter = { userId: req.user._id };
    if (unreadOnly === 'true' || unreadOnly === true) filter.read = false;
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    ).lean();
    if (!n) return res.status(404).json({ message: 'Notification not found' });
    res.json(n);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id }, { read: true });
    res.json({ message: 'All marked read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
