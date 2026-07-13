import mongoose from 'mongoose';

const conditionSchema = new mongoose.Schema(
  {
    metric: { type: String, required: true },
    operator: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed },
    thresholdKey: { type: String, default: '' },
  },
  { _id: false }
);

const conditionGroupSchema = new mongoose.Schema(
  {
    logic: { type: String, enum: ['and', 'or'], default: 'and' },
    conditions: { type: [conditionSchema], default: [] },
  },
  { _id: false }
);

const conditionTreeSchema = new mongoose.Schema(
  {
    rootLogic: { type: String, enum: ['and', 'or'], default: 'and' },
    groups: { type: [conditionGroupSchema], default: [] },
  },
  { _id: false }
);

const insightRuleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    ruleKey: { type: String, required: true, index: true },
    isBuiltin: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'custom' },
    ruleType: {
      type: String,
      enum: ['asset', 'budget', 'aggregate', 'org'],
      default: 'asset',
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'warning',
    },
    enabled: { type: Boolean, default: true },
    messageTemplate: { type: String, default: '{{count}} items match this insight' },
    conditionTree: { type: conditionTreeSchema, default: () => ({ rootLogic: 'and', groups: [] }) },
    link: { type: String, default: '/dashboard/assets' },
    order: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

insightRuleSchema.index({ organizationId: 1, ruleKey: 1 }, { unique: true });

export default mongoose.model('InsightRule', insightRuleSchema);
