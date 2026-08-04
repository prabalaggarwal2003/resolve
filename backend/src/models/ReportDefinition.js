import mongoose from 'mongoose';

const filterConditionSchema = new mongoose.Schema(
  {
    source: { type: String },
    field: { type: String },
    op: { type: String },
    value: { type: mongoose.Schema.Types.Mixed },
    valueTo: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const filterGroupSchema = new mongoose.Schema(
  {
    logic: { type: String, enum: ['and', 'or'], default: 'and' },
    conditions: [filterConditionSchema],
    groups: [mongoose.Schema.Types.Mixed],
  },
  { _id: false }
);

const reportFieldSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    key: { type: String, required: true },
    label: { type: String },
    pinned: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

/** Explicit `{ type: String }` required — a bare `type: String` is treated as schema-type, not a field. */
const calculationSchema = new mongoose.Schema(
  {
    id: { type: String },
    type: { type: String },
    field: { type: String },
    source: { type: String },
    label: { type: String },
  },
  { _id: false }
);

const visualizationSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'table' },
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const configSchema = new mongoose.Schema(
  {
    primarySource: { type: String, required: true },
    dataSources: [{ type: String }],
    fields: [reportFieldSchema],
    filters: { type: filterGroupSchema, default: () => ({ logic: 'and', conditions: [] }) },
    groupBy: [
      {
        source: { type: String },
        key: { type: String },
      },
    ],
    sort: [
      {
        source: { type: String },
        key: { type: String },
        dir: { type: String, enum: ['asc', 'desc'], default: 'asc' },
      },
    ],
    calculations: [calculationSchema],
    visualization: { type: visualizationSchema, default: () => ({ type: 'table', options: {} }) },
    formatting: { type: mongoose.Schema.Types.Mixed, default: {} },
    exportOptions: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const reportDefinitionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    kind: {
      type: String,
      enum: ['saved', 'template', 'draft', 'quick'],
      default: 'saved',
      index: true,
    },
    scope: {
      type: String,
      enum: ['user', 'organization', 'system'],
      default: 'user',
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    quickKey: { type: String, index: true },
    category: { type: String, default: '' },
    favouriteBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    sharedWithRoleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrgRole' }],
    published: { type: Boolean, default: false },
    config: { type: configSchema, required: true },
    lastRunAt: Date,
    runCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

reportDefinitionSchema.index({ organizationId: 1, kind: 1, updatedAt: -1 });
reportDefinitionSchema.index({ organizationId: 1, ownerId: 1 });
reportDefinitionSchema.index({ organizationId: 1, name: 'text', description: 'text' });

export default mongoose.model('ReportDefinition', reportDefinitionSchema);
