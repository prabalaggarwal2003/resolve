import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    tempData: {
      name: String,
      passwordHash: String,
      organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL: auto-delete expired

export default mongoose.model('Otp', otpSchema);
