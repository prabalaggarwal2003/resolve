import mongoose from 'mongoose';

const rateLimitSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true }, // Device fingerprint
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    lastReportAt: { type: Date, required: true },
    reportCount: { type: Number, default: 1 },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

rateLimitSchema.index({ deviceId: 1, assetId: 1 });
rateLimitSchema.index({ lastReportAt: 1 }, { expireAfterSeconds: 600 }); // Auto-delete after 10 minutes

export default mongoose.model('RateLimit', rateLimitSchema);
