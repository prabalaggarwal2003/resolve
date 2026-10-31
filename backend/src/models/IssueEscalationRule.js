import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    assetCategories: [{ type: String, trim: true }],
    issueTypeIds: [{ type: String, trim: true }],
    priorityIds: [{ type: String, trim: true }],
    locationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
    departmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  },
  { _id: false }
);

const triggerSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['sla_pct', 'sla_breached', 'unresolved_hours'],
      required: true,
    },
    /** For sla_pct: fire when elapsed >= this % of resolution window (e.g. 80) */
    slaPct: { type: Number, min: 1, max: 100 },
    /** For unresolved_hours: hours since created while still open */
    unresolvedHours: { type: Number, min: 0.25 },
  },
  { _id: false }
);

const issueEscalationRuleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    match: { type: matchSchema, default: () => ({}) },
    /**
     * How multiple triggers combine.
     * and = all must be true; or = any one is enough.
     */
    triggerLogic: {
      type: String,
      enum: ['and', 'or'],
      default: 'or',
    },
    /** One or more trigger conditions (preferred) */
    triggers: { type: [triggerSchema], default: undefined },
    /** Legacy single trigger — still read for older rules */
    trigger: { type: triggerSchema, required: false },
    actions: {
      notifyAssignee: { type: Boolean, default: true },
      notifyUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      notifyGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactGroup' },
      bumpPriorityId: { type: String, trim: true, default: '' },
      reassign: {
        /** Required when reassigning — person who receives escalated work */
        assigneeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        assigneeGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactGroup' },
        assigneeDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
      },
    },
    cooldownMinutes: { type: Number, default: 60, min: 5 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

issueEscalationRuleSchema.index({ organizationId: 1, enabled: 1, sortOrder: 1 });

export default mongoose.model('IssueEscalationRule', issueEscalationRuleSchema);
