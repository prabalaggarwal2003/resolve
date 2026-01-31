import mongoose from 'mongoose';

const assetLogSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['check_in', 'check_out'], required: true },
    assignedAt: Date,
    unassignedAt: Date,
    notes: String,
  },
  { timestamps: true }
);

assetLogSchema.index({ assetId: 1, createdAt: -1 });
assetLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('AssetLog', assetLogSchema);
