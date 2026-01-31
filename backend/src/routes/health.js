import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

export default router;
