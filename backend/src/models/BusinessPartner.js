import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    role: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    mobile: { type: String, trim: true, default: '' },
    whatsapp: { type: String, trim: true, default: '' },
    notes: { type: String, default: '' },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true }
);

const addressSchema = new mongoose.Schema(
  {
    typeKey: { type: String, default: 'registered' },
    label: { type: String, default: '' },
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true }
);

const businessPartnerSchema = new mongoose.Schema(
  {
    partnerCode: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    partnerTypeKey: { type: String, default: 'vendor', index: true },
    categoryKey: { type: String, default: 'other', index: true },
    status: { type: String, default: 'Active', index: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: String,
    taxId: String,
    notes: String,
    paymentTerms: { type: String, default: 'Net 30' },
    creditLimit: { type: Number, default: null },
    currency: { type: String, default: 'INR' },
    registrationDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    businessDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    bankDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    taxDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    primaryContact: {
      name: String,
      role: String,
      department: String,
      email: String,
      phone: String,
      mobile: String,
      whatsapp: String,
      notes: String,
    },
    contacts: [contactSchema],
    addresses: [addressSchema],
    tags: [{ type: String, trim: true }],
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    averageRating: { type: Number, default: null },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'businesspartners' }
);

businessPartnerSchema.index({ organizationId: 1, partnerCode: 1 }, { unique: true });
businessPartnerSchema.index({ organizationId: 1, name: 1 });
businessPartnerSchema.index({ organizationId: 1, status: 1 });
businessPartnerSchema.index({ organizationId: 1, partnerTypeKey: 1 });

// Legacy virtuals for vendor API compatibility
businessPartnerSchema.virtual('vendorId').get(function () {
  return this.partnerCode;
});
businessPartnerSchema.virtual('category').get(function () {
  return this.categoryKey;
});
businessPartnerSchema.virtual('contactPerson').get(function () {
  return this.primaryContact?.name || this.contacts?.find((c) => c.isPrimary)?.name || '';
});

businessPartnerSchema.set('toJSON', { virtuals: true });
businessPartnerSchema.set('toObject', { virtuals: true });

const BusinessPartner =
  mongoose.models.BusinessPartner || mongoose.model('BusinessPartner', businessPartnerSchema);

// Alias for existing ref: 'Vendor' populate paths — same collection
if (!mongoose.models.Vendor) {
  mongoose.model('Vendor', businessPartnerSchema, 'businesspartners');
}

export default BusinessPartner;
