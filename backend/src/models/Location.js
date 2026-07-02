import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    path: { type: String, default: '' },
    code: String,
    description: { type: String, default: '' },
    capacity: { type: Number, default: null },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

locationSchema.index({ parentId: 1 });
locationSchema.index({ path: 'text', name: 'text' });
locationSchema.index({ type: 1 });
locationSchema.index({ organizationId: 1 });

export default mongoose.model('Location', locationSchema);
