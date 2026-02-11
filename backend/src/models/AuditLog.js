import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    action: { type: String, required: true }, // e.g. created, updated, deleted, assigned, status_changed
    resource: { type: String, required: true }, // asset, issue, user, organization, location, department
    resourceId: mongoose.Schema.Types.ObjectId,
    resourceName: String, // Human readable name/identifier of the resource
    description: String, // Human readable description of what happened
    details: mongoose.Schema.Types.Mixed, // { field: { old: oldValue, new: newValue } } or other relevant data
    ipAddress: String,
    userAgent: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    }
  },
  { timestamps: true }
);

// Indexes for efficient querying
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
