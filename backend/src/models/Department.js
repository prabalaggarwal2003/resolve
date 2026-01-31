import mongoose from 'mongoose';

// School/college: Administration, Science, Computer Lab, Library, Sports, etc.
const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    description: String,
  },
  { timestamps: true }
);

departmentSchema.index({ locationId: 1 });

export default mongoose.model('Department', departmentSchema);
