import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'principal', 'hod', 'teacher', 'student', 'lab_technician', 'admin', 'manager', 'reporter'],
      default: 'reporter',
    },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    assignedLocationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
    phone: String,
    avatar: String,
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    onboardingComplete: { type: Boolean, default: false },
    lastLogin: Date,
  },
  { timestamps: true }
);

// email index is created by unique: true on the field
userSchema.index({ role: 1 });
userSchema.index({ organizationId: 1 });
userSchema.index({ departmentId: 1 });

userSchema.methods.matchPassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

export default mongoose.model('User', userSchema);
