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

const dimensionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const customFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'select', 'multiselect', 'textarea', 'currency'],
      default: 'text',
    },
    required: { type: Boolean, default: false },
    options: [String],
    section: { type: String, default: 'Details' },
  },
  { _id: false }
);

const lifecycleStageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, default: '' },
    bucket: {
      type: String,
      enum: ['planned', 'committed', 'actual', 'cancelled'],
      default: 'planned',
    },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const budgetOrgConfigSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    budgetTypes: [optionItemSchema],
    budgetStatuses: [optionItemSchema],
    fundingSources: [optionItemSchema],
    enabledDimensions: [dimensionSchema],
    customFields: [customFieldSchema],
    procurementLifecycleStages: [lifecycleStageSchema],
    procurementPaymentStatuses: [optionItemSchema],
    procurementCustomFields: [customFieldSchema],
    settings: {
      autoUpdateOnAssetCreate: { type: Boolean, default: true },
      autoUpdateOnPurchaseApprove: { type: Boolean, default: true },
      warnThresholdPct: { type: Number, default: 80 },
      criticalThresholdPct: { type: Number, default: 100 },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('BudgetOrgConfig', budgetOrgConfigSchema);
