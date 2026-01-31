import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g. asset.created, asset.updated, asset.deleted, issue.updated
    resource: { type: String, required: true }, // asset, issue, user
    resourceId: mongoose.Schema.Types.ObjectId,
    details: mongoose.Schema.Types.Mixed, // { field: oldValue/newValue } or summary
  },
  { timestamps: true }
);

auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
