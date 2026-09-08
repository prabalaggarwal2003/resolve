import mongoose from 'mongoose';

const issueActivitySchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'created',
        'status_changed',
        'assigned',
        'priority_changed',
        'severity_changed',
        'comment',
        'internal_note',
        'resolution',
        'verification',
        'reopened',
        'closed',
        'field_updated',
        'attachment_added',
        'report_merged',
        'escalated',
        'auto_assigned',
      ],
    },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, default: '' },
    actorKind: { type: String, enum: ['user', 'public', 'system'], default: 'user' },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
    reason: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

issueActivitySchema.index({ issueId: 1, at: 1 });

function rejectMutation() {
  const err = new Error('Issue activity history is immutable and cannot be modified or deleted');
  err.status = 403;
  throw err;
}

issueActivitySchema.pre('save', function (next) {
  if (!this.isNew) return next(rejectMutation());
  next();
});

for (const hook of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne']) {
  issueActivitySchema.pre(hook, function () {
    rejectMutation();
  });
}

for (const hook of ['deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndRemove']) {
  issueActivitySchema.pre(hook, function () {
    rejectMutation();
  });
}

export default mongoose.model('IssueActivity', issueActivitySchema);
