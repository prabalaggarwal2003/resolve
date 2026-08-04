import mongoose from 'mongoose';

const templateFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'select', 'textarea', 'checkbox', 'radio', 'status', 'tags', 'location'],
      default: 'text',
    },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    section: {
      type: String,
      enum: ['basic', 'assignment', 'purchase', 'custom'],
      default: 'basic',
    },
    builtIn: { type: Boolean, default: false },
    /** When parent section is QR-enabled, show this field on the public QR page */
    qrVisible: { type: Boolean, default: true },
    options: [{ type: String }],
  },
  { _id: false }
);

const qrSectionsSchema = new mongoose.Schema(
  {
    basic: { type: Boolean, default: true },
    assignment: { type: Boolean, default: true },
    purchase: { type: Boolean, default: true },
    custom: { type: Boolean, default: true },
    photos: { type: Boolean, default: true },
    documents: { type: Boolean, default: true },
    maintenance: { type: Boolean, default: true },
    issues: { type: Boolean, default: true },
  },
  { _id: false }
);

const assetTemplateSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    fields: [templateFieldSchema],
    /** Which sections appear when an asset using this template is scanned via QR */
    qrSections: { type: qrSectionsSchema, default: () => ({}) },
    statuses: [{ type: String, trim: true }],
    tagSuggestions: [{ type: String, trim: true }],
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetGroup', default: null },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

assetTemplateSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export default mongoose.model('AssetTemplate', assetTemplateSchema);
