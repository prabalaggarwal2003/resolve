import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true }, // report_submitted, report_updated, report_resolved, maintenance_due
    title: { type: String, required: true },
    body: String,
    link: String, // e.g. /dashboard/issues/xxx
    read: { type: Boolean, default: false },
    metadata: mongoose.Schema.Types.Mixed, // { issueId, assetId, ... }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
