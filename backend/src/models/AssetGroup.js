import mongoose from 'mongoose';

const assetGroupSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    key: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

assetGroupSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export default mongoose.model('AssetGroup', assetGroupSchema);
