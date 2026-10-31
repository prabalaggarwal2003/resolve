import mongoose from 'mongoose';

const optionItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    color: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    isClosed: { type: Boolean, default: false },
  },
  { _id: false }
);

const issueTypeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    color: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    /** Phase 2: form field definitions */
    formFields: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const issueOrgConfigSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    statuses: [optionItemSchema],
    priorities: [optionItemSchema],
    severities: [optionItemSchema],
    issueTypes: [issueTypeSchema],
    settings: {
      ticketPrefix: { type: String, default: 'TKT' },
      defaultPriorityId: { type: String, default: 'medium' },
      defaultSeverityId: { type: String, default: 'medium' },
      defaultIssueTypeId: { type: String, default: 'incident' },
      defaultWorkflowKey: { type: String, default: 'default' },
      requireVerificationBeforeClose: { type: Boolean, default: true },
      preventSelfVerification: { type: Boolean, default: true },
      /** Next sequence number for auto-generated employee IDs (import). */
      employeeIdAutoSeq: { type: Number, default: 1 },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('IssueOrgConfig', issueOrgConfigSchema);
