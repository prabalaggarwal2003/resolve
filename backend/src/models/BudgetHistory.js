import mongoose from 'mongoose';

const changeSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    label: { type: String, default: '' },
    from: { type: mongoose.Schema.Types.Mixed, default: null },
    to: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const budgetHistorySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    /** Which module entity this event belongs to */
    entityType: {
      type: String,
      enum: ['budget', 'procurement'],
      default: 'budget',
      index: true,
    },
    /** Set for budget events and procurement events linked to a budget */
    budgetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Budget',
      default: null,
      index: true,
    },
    /** Set for procurement events */
    procurementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Procurement',
      default: null,
      index: true,
    },
    /** Human-readable name of the entity at the time of the event (survives deletes) */
    entityLabel: { type: String, default: '' },
    eventType: {
      type: String,
      required: true,
      enum: [
        'budget_created',
        'budget_updated',
        'allocation_increased',
        'allocation_reduced',
        'status_changed',
        'purchase_linked',
        'purchase_cancelled',
        'budget_closed',
        'note_added',
        'procurement_created',
        'procurement_updated',
        'procurement_deleted',
      ],
    },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    /** Field-level change log: what changed, old value, new value */
    changes: { type: [changeSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, default: '' },
  },
  { timestamps: true }
);

budgetHistorySchema.index({ budgetId: 1, createdAt: -1 });
budgetHistorySchema.index({ procurementId: 1, createdAt: -1 });
budgetHistorySchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model('BudgetHistory', budgetHistorySchema);
