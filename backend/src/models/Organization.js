import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    industry: {
      type: String,
      enum: ['IT', 'Construction', 'Healthcare', 'Education', 'Manufacturing', 'Retail', 'Other'],
    },
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
    },
    country: String,
    region: String,
    primaryGoal: {
      type: String,
      enum: ['track_it_assets', 'maintenance', 'inventory', 'compliance', 'other'],
    },
    estimatedAssets: {
      type: String,
      enum: ['1-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    logo: String,
  },
  { timestamps: true }
);

organizationSchema.index({ name: 1 });

export default mongoose.model('Organization', organizationSchema);
