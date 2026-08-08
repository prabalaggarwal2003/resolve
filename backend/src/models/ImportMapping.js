import mongoose from 'mongoose';

const destinationFieldSchema = new mongoose.Schema(
  {
    key: String,
    label: String,
    type: String,
    required: Boolean,
    section: String,
    builtIn: Boolean,
    options: [String],
    relationship: String,
  },
  { _id: false }
);

const columnMappingSchema = new mongoose.Schema(
  {
    sourceColumn: { type: String, required: true },
    targetField: { type: String, default: '' },
    ignored: { type: Boolean, default: false },
    suggested: { type: Boolean, default: false },
    createCustomField: { type: Boolean, default: false },
    customField: {
      key: String,
      label: String,
      type: { type: String, default: 'text' },
      section: { type: String, default: 'custom' },
      options: [String],
    },
  },
  { _id: false }
);

const importMappingSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: ['assets', 'businessPartners', 'users', 'locations', 'inventory'],
      default: 'assets',
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetTemplate', default: null },
    sourceHeaders: [{ type: String }],
    columnMappings: [columnMappingSchema],
    valueMappings: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    transforms: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    relationshipRules: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    duplicateHandling: {
      type: String,
      enum: ['skip', 'update', 'create_new', 'stop'],
      default: 'skip',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

importMappingSchema.index({ organizationId: 1, module: 1, name: 1 }, { unique: true });

export default mongoose.model('ImportMapping', importMappingSchema);
export { columnMappingSchema, destinationFieldSchema };
