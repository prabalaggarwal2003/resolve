import mongoose from 'mongoose';

const widgetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    kind: { type: String, enum: ['metric', 'list', 'quick'], default: 'metric' },
    metric: { type: String, default: '' },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    filterFields: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    colSpan: { type: Number, default: 1 },
    rowSpan: { type: Number, default: 1 },
  },
  { _id: false }
);

const businessPartnerDashboardSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    scope: { type: String, enum: ['personal', 'organization'], default: 'personal' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    allowedRoleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrgRole' }],
    autoRefresh: {
      type: String,
      enum: ['manual', '1m', '5m', '15m'],
      default: 'manual',
    },
    layout: {
      version: { type: Number, default: 1 },
      widgets: [widgetSchema],
    },
  },
  { timestamps: true }
);

businessPartnerDashboardSchema.index({ organizationId: 1, scope: 1, ownerId: 1 });

export default mongoose.model('BusinessPartnerDashboard', businessPartnerDashboardSchema);
