import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    severity: { type: String, enum: ['error', 'warning', 'info'], default: 'error' },
    field: { type: String, default: '' },
    message: { type: String, required: true },
  },
  { _id: false }
);

const importJobRowSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImportJob',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    rowIndex: { type: Number, required: true },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
    mapped: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'valid', 'warning', 'error', 'created', 'updated', 'skipped', 'failed'],
      default: 'pending',
      index: true,
    },
    issues: [issueSchema],
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
  },
  { timestamps: true }
);

importJobRowSchema.index({ jobId: 1, rowIndex: 1 }, { unique: true });

export default mongoose.model('ImportJobRow', importJobRowSchema);
