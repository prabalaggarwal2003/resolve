import mongoose from 'mongoose';

const transitionSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    allowedRoles: { type: [String], default: [] },
    requireReason: { type: Boolean, default: false },
    requiredFields: { type: [String], default: [] },
    requireAttachment: { type: Boolean, default: false },
    requireApproval: { type: Boolean, default: false },
  },
  { _id: false }
);

const issueWorkflowSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    stages: { type: [String], default: [] },
    transitions: { type: [transitionSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

issueWorkflowSchema.index({ organizationId: 1, key: 1 }, { unique: true });

export default mongoose.model('IssueWorkflow', issueWorkflowSchema);
