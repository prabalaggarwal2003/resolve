import mongoose from 'mongoose';

const assetHealthScoreSnapshotSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    date: { type: String, required: true },
    avgScore: { type: Number, default: 0 },
    assetCount: { type: Number, default: 0 },
    distribution: {
      excellent: { type: Number, default: 0 },
      good: { type: Number, default: 0 },
      fair: { type: Number, default: 0 },
      poor: { type: Number, default: 0 },
      critical: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

assetHealthScoreSnapshotSchema.index({ organizationId: 1, date: 1 }, { unique: true });

export default mongoose.model('AssetHealthScoreSnapshot', assetHealthScoreSnapshotSchema);
