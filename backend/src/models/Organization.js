import mongoose from 'mongoose';

const orgContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    role: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true }
);

const orgAddressSchema = new mongoose.Schema(
  {
    typeKey: {
      type: String,
      enum: ['head_office', 'registered', 'warehouse', 'branch', 'billing', 'shipping', 'other'],
      default: 'head_office',
    },
    label: { type: String, trim: true, default: '' },
    street: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    zipCode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    isPrimary: { type: Boolean, default: false },
    /** Optional link to a contact subdocument `_id` on the same organization. */
    contactId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { _id: true }
);

const orgCustomFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'select', 'textarea'],
      default: 'text',
    },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
  },
  { _id: false }
);

const organizationSchema = new mongoose.Schema(
  {
    orgId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, index: true },
    industry: {
      type: String,
      enum: ['IT', 'Construction', 'Healthcare', 'Education', 'Manufacturing', 'Retail', 'Other'],
      index: true,
    },
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
      index: true,
    },
    country: { type: String, index: true },
    region: { type: String, index: true },
    website: { type: String, trim: true, default: '' },
    timezone: { type: String, trim: true, default: 'Asia/Kolkata' },
    currency: { type: String, trim: true, uppercase: true, default: 'INR' },
    gstin: { type: String, trim: true, uppercase: true },
    registeredAddress: { type: String, trim: true },
    contacts: { type: [orgContactSchema], default: [] },
    addresses: { type: [orgAddressSchema], default: [] },
    customFieldDefinitions: { type: [orgCustomFieldSchema], default: [] },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    primaryGoal: {
      type: String,
      enum: ['track_it_assets', 'maintenance', 'inventory', 'compliance', 'other'],
    },
    estimatedAssets: {
      type: String,
      enum: ['1-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    logo: String,
    subscriptionTier: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      default: 'free',
      index: true,
    },
    subscriptionPlan: {
      type: String,
      enum: ['monthly', 'annual'],
      default: 'monthly',
    },
    razorpaySubscriptionId: String,
    subscriptionStartDate: Date,
    subscriptionEndDate: Date,
    trialEndsAt: Date,
  },
  { timestamps: true }
);

organizationSchema.index({ name: 1 });

export default mongoose.model('Organization', organizationSchema);
