import mongoose from 'mongoose';

const assetHealthProfileSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    /** When set, applies to assets in this group; null = named profile only */
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetGroup', default: null },
    enabled: { type: Boolean, default: true },
    factors: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    thresholds: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    order: { type: Number, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

assetHealthProfileSchema.index({ organizationId: 1, groupId: 1 });

export default mongoose.model('AssetHealthProfile', assetHealthProfileSchema);
