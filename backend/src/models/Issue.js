import mongoose from 'mongoose';

const reportFollowUpSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const reportEntrySchema = new mongoose.Schema(
  {
    reportId: { type: String, index: true },
    trackingToken: { type: String, index: true },
    reporterName: { type: String, required: true },
    reporterEmail: { type: String, required: true },
    reporterPhone: String,
    description: { type: String, required: true },
    photos: [{ url: String, uploadedAt: { type: Date, default: Date.now } }],
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** new | acknowledged | resolved_visible (derived from parent for display) */
    status: { type: String, default: 'new', enum: ['new', 'acknowledged'] },
    acknowledgedAt: Date,
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Reporter follow-ups when problem still exists after resolution */
    followUps: [reportFollowUpSchema],
  },
  { timestamps: true, _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

/** Contact / partner contact linked to a ticket (not the assignee/handler). */
const relatedPersonSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['contact', 'partnerContact'], required: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessPartner' },
    partnerContactId: { type: mongoose.Schema.Types.ObjectId },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    role: { type: String, default: '', trim: true },
    company: { type: String, default: '', trim: true },
    /** How this person relates to the ticket (e.g. vendor tech, site contact). */
    relation: { type: String, required: true, trim: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const issueSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reporterName: String,
    reporterEmail: String,
    reporterPhone: String,
    title: { type: String, required: true },
    description: String,
    /** @deprecated Prefer issueTypeId; kept for legacy public report merge. */
    category: { type: String, default: 'repair' },
    issueTypeId: { type: String, default: 'incident' },
    /** Status key from IssueOrgConfig.statuses (legacy enum values migrated). */
    status: { type: String, default: 'new', index: true },
    statusId: { type: String, default: 'new' },
    priority: { type: String, default: 'medium' },
    priorityId: { type: String, default: 'medium' },
    severityId: { type: String, default: 'medium' },
    workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueWorkflow' },
    workflowKey: { type: String, default: 'default' },
    photos: [{ url: String, uploadedAt: { type: Date, default: Date.now } }],
    attachments: [attachmentSchema],
    reports: [reportEntrySchema],
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assigneeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** @deprecated Contacts are related persons, not handlers. Kept for legacy data. */
    assigneeContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    assigneeGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactGroup' },
    /** Owning org department (from Departments managed with locations). */
    assigneeDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    assignedAt: Date,
    relatedPersons: [relatedPersonSchema],
    tags: [{ type: String, trim: true }],
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    mergedFrom: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Issue' }],
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    dueAt: Date,
    sla: {
      responseDueAt: Date,
      resolutionDueAt: Date,
      pausedAt: Date,
      breached: { type: Boolean, default: false },
    },
    escalation: {
      level: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['none', 'warned', 'escalated', 'was_escalated'],
        default: 'none',
      },
      lastRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueEscalationRule' },
      lastFiredAt: Date,
      lastReason: { type: String, default: '' },
      lastTargetLabel: { type: String, default: '' },
      /** User the ticket was last escalated to (for filtering). */
      lastTargetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      firedRuleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'IssueEscalationRule' }],
      history: [
        {
          ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueEscalationRule' },
          level: Number,
          reason: String,
          targetLabel: String,
          targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          source: { type: String, enum: ['rule', 'manual', 'settled'], default: 'rule' },
          actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          actorName: { type: String, default: '' },
          at: { type: Date, default: Date.now },
        },
      ],
    },
    resolution: {
      notes: String,
      resolvedAt: Date,
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    verification: {
      notes: String,
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    /** Legacy flat resolution fields — kept in sync when resolution is set. */
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: String,
  },
  { timestamps: true }
);

issueSchema.index({ ticketId: 1 }, { unique: true });
issueSchema.index({ assetId: 1 });
issueSchema.index({ assetId: 1, status: 1, category: 1 });
issueSchema.index({ status: 1 });
issueSchema.index({ statusId: 1 });
issueSchema.index({ assignedTo: 1 });
issueSchema.index({ assigneeUserId: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ organizationId: 1 });
issueSchema.index({ organizationId: 1, statusId: 1 });
issueSchema.index({ issueTypeId: 1 });
issueSchema.index({ 'reports.trackingToken': 1 }, { sparse: true });
issueSchema.index({ 'reports.reportId': 1 }, { sparse: true });

export default mongoose.model('Issue', issueSchema);
