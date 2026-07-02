import mongoose from 'mongoose';

const depreciationPolicySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    method: { type: String, enum: ['SLM', 'WDV'], required: true },
    rate: { type: Number, required: true, min: 0, max: 100 },
    /** Per-year rates (year 1, 2, …). Years beyond the schedule use `rate`. */
    yearRates: [
      {
        year: { type: Number, required: true, min: 1 },
        rate: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    residualPct: { type: Number, default: 5, min: 0, max: 100 },
    isOrgDefault: { type: Boolean, default: false },
    description: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

depreciationPolicySchema.index({ organizationId: 1, name: 1 }, { unique: true });

export default mongoose.model('DepreciationPolicy', depreciationPolicySchema);
