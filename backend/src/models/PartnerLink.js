import mongoose from 'mongoose';

const partnerLinkSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessPartner',
      required: true,
      index: true,
    },
    relationshipTypeKey: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
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

partnerLinkSchema.index(
  { organizationId: 1, partnerId: 1, relationshipTypeKey: 1, resourceType: 1, resourceId: 1 },
  { unique: true }
);

export default mongoose.model('PartnerLink', partnerLinkSchema);
