import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    budgetTypeId: { type: String, default: 'annual' },
    financialYear: { type: String, trim: true, default: '' },
    periodLabel: { type: String, trim: true, default: '' },
    startDate: { type: Date },
    endDate: { type: Date },
    allocatedAmount: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: 'INR', trim: true },
    budgetOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    description: { type: String, default: '' },
    status: { type: String, default: 'draft', index: true },
    notes: { type: String, default: '' },
    /** Dimension values — keys match BudgetOrgConfig.enabledDimensions */
    dimensions: { type: mongoose.Schema.Types.Mixed, default: {} },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Financial rollups (updated by procurement/asset hooks later) */
    plannedAmount: { type: Number, default: 0, min: 0 },
    committedAmount: { type: Number, default: 0, min: 0 },
    actualSpend: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

budgetSchema.index({ organizationId: 1, name: 1 });
budgetSchema.index({ organizationId: 1, status: 1 });
budgetSchema.index({ organizationId: 1, financialYear: 1 });

budgetSchema.virtual('remainingAmount').get(function remainingAmount() {
  const allocated = this.allocatedAmount || 0;
  const spent = Math.max(this.actualSpend || 0, this.committedAmount || 0);
  return Math.max(0, allocated - spent);
});

budgetSchema.virtual('utilizationPct').get(function utilizationPct() {
  const allocated = this.allocatedAmount || 0;
  if (!allocated) return 0;
  const spent = this.actualSpend || 0;
  return Math.round((spent / allocated) * 1000) / 10;
});

budgetSchema.set('toJSON', { virtuals: true });
budgetSchema.set('toObject', { virtuals: true });

export default mongoose.model('Budget', budgetSchema);
