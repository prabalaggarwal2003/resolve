import mongoose from 'mongoose';

const orgRoleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

orgRoleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export default mongoose.model('OrgRole', orgRoleSchema);
