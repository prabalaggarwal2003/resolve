import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: '' },
  },
  { _id: false }
);

const partnerContractSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessPartner',
      required: true,
      index: true,
    },
    contractNumber: { type: String, required: true, trim: true },
    title: { type: String, trim: true, default: '' },
    startDate: Date,
    endDate: Date,
    renewalDate: Date,
    autoRenewal: { type: Boolean, default: false },
    reminderDays: { type: Number, default: 30 },
    status: {
      type: String,
      enum: ['Draft', 'Active', 'Expired', 'Renewed', 'Cancelled'],
      default: 'Draft',
    },
    linkedAssetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Asset' }],
    attachments: [attachmentSchema],
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
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

partnerContractSchema.index({ organizationId: 1, contractNumber: 1 });
partnerContractSchema.index({ organizationId: 1, endDate: 1, status: 1 });

export default mongoose.model('PartnerContract', partnerContractSchema);
