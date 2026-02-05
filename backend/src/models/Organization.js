import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    orgId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    name: { type: String, required: true, index: true },
    industry: {
      type: String,
      enum: ['IT', 'Construction', 'Healthcare', 'Education', 'Manufacturing', 'Retail', 'Other'],
      index: true
    },
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
      index: true
    },
    country: { type: String, index: true },
    region: { type: String, index: true },
    primaryGoal: {
      type: String,
      enum: ['track_it_assets', 'maintenance', 'inventory', 'compliance', 'other']
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
