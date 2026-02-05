import mongoose from 'mongoose';

// School/college: Campus → Block/Building → Floor → Room (Classroom, Lab, Office)
const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['campus', 'building', 'floor', 'room'],
      required: true,
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    path: { type: String, default: '' }, // e.g. "Main Campus/Building A/Floor 2/Room 201"
    code: String, // e.g. "BLK-A", "R-201"
    organizationId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Organization', 
      required: true,
      index: true 
    },
  },
  { timestamps: true }
);

locationSchema.index({ parentId: 1 });
locationSchema.index({ path: 'text' });
locationSchema.index({ type: 1 });
locationSchema.index({ organizationId: 1 });

export default mongoose.model('Location', locationSchema);
