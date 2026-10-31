import mongoose from 'mongoose';

/**
 * Org-scoped auto-assignment rule.
 * Match dimensions that have values are ANDed; within a dimension listed values are ORed.
 * assigneeUserId is required — the person who receives the ticket.
 */
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

const issueAutomationRuleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    /** Lower runs first */
    sortOrder: { type: Number, default: 0 },
    match: { type: matchSchema, default: () => ({}) },
    assign: {
      assigneeUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      assigneeGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactGroup' },
      assigneeDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    },
    /** Hours until resolution SLA due (optional; falls back to priority defaults) */
    slaResolutionHours: { type: Number, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

issueAutomationRuleSchema.index({ organizationId: 1, enabled: 1, sortOrder: 1 });

export default mongoose.model('IssueAutomationRule', issueAutomationRuleSchema);
