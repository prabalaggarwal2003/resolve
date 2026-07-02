import mongoose from 'mongoose';

const locationTypeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: '📍' },
    color: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

locationTypeSchema.index({ organizationId: 1, key: 1 }, { unique: true });

export default mongoose.model('LocationType', locationTypeSchema);
