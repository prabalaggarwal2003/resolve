import mongoose from 'mongoose';

const partnerActivitySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessPartner',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'created',
        'updated',
        'note',
        'document',
        'contract',
        'link',
        'invoice',
        'purchase',
        'payment',
        'contact',
        'address',
        'tag',
        'other',
      ],
      default: 'other',
    },
    summary: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

partnerActivitySchema.index({ partnerId: 1, createdAt: -1 });

export default mongoose.model('PartnerActivity', partnerActivitySchema);
