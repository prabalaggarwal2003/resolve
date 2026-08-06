import mongoose from 'mongoose';

const partnerDocumentSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessPartner',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'General' },
    url: { type: String, required: true },
    notes: { type: String, default: '' },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

partnerDocumentSchema.index({ organizationId: 1, partnerId: 1 });

export default mongoose.model('PartnerDocument', partnerDocumentSchema);
