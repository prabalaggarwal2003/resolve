import mongoose from 'mongoose';

const budgetDashboardSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    scope: { type: String, enum: ['personal', 'organization'], default: 'personal' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    templateId: { type: String, default: null },
    allowedRoleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrgRole' }],
    autoRefresh: { type: String, enum: ['manual', '1m', '5m', '15m'], default: 'manual' },
    layout: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ version: 1, widgets: [] }),
    },
  },
  { timestamps: true }
);

budgetDashboardSchema.index({ organizationId: 1, scope: 1 });
budgetDashboardSchema.index({ organizationId: 1, ownerId: 1 });

export default mongoose.model('BudgetDashboard', budgetDashboardSchema);
