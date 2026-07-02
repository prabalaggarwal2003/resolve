import mongoose from 'mongoose';

const depreciationPolicyAssignmentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DepreciationPolicy',
      required: true,
    },
    targetType: { type: String, enum: ['group', 'category'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetKey: { type: String, trim: true },
  },
  { timestamps: true }
);

depreciationPolicyAssignmentSchema.index(
  { organizationId: 1, targetType: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { targetType: 'group' } }
);
depreciationPolicyAssignmentSchema.index(
  { organizationId: 1, targetType: 1, targetKey: 1 },
  { unique: true, partialFilterExpression: { targetType: 'category' } }
);

export default mongoose.model('DepreciationPolicyAssignment', depreciationPolicyAssignmentSchema);
