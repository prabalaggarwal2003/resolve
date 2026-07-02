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
    options: [{ type: String }],
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
