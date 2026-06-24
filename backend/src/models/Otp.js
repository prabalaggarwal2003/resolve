import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    purpose: {
      type: String,
      enum: ['signup', 'password_reset'],
      default: 'signup',
    },
    codeHash: { type: String, required: true },
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
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Otp', otpSchema);
