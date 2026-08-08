import mongoose from 'mongoose';
import { columnMappingSchema } from './ImportMapping.js';

const headerSchema = new mongoose.Schema(
  {
    key: String,
    label: String,
    sampleValues: [String],
    detectedType: { type: String, default: 'text' },
  },
  { _id: false }
);

const importJobSchema = new mongoose.Schema(
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
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ['csv', 'xlsx'], required: true },
    sheetNames: [{ type: String }],
    sheetName: { type: String, default: '' },
    /** Raw file kept briefly for sheet re-selection (binary). Cleared after import completes. */
    fileBuffer: { type: Buffer, select: false },
    headers: [headerSchema],
    rowCount: { type: Number, default: 0 },
    previewRows: [{ type: mongoose.Schema.Types.Mixed }],
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetTemplate', default: null },
    columnMappings: [columnMappingSchema],
    valueMappings: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    transforms: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    relationshipRules: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    duplicateHandling: {
      type: String,
      enum: ['skip', 'update', 'create_new', 'stop'],
      default: 'skip',
    },
    savedMappingId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportMapping', default: null },
    status: {
      type: String,
      enum: [
        'uploaded',
        'configured',
        'mapped',
        'validated',
        'importing',
        'completed',
        'failed',
        'cancelled',
      ],
      default: 'uploaded',
      index: true,
    },
    validationSummary: {
      valid: { type: Number, default: 0 },
      warnings: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
    },
    result: {
      created: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    errorMessage: { type: String, default: '' },
    /** UI wizard step so refresh can resume mid-import */
    wizardStep: {
      type: String,
      enum: ['upload', 'configure', 'map', 'values', 'validate', 'preview', 'import'],
      default: 'upload',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

importJobSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model('ImportJob', importJobSchema);
