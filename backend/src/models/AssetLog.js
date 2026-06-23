import mongoose from 'mongoose';

const fieldChangeSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    label: { type: String, required: true },
    oldValue: { type: String, default: '—' },
    newValue: { type: String, default: '—' },
  },
  { _id: false }
);

const assetLogSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    editorName: String,
    type: { type: String, enum: ['check_in', 'check_out', 'edit'], required: true },
    assignedAt: Date,
    unassignedAt: Date,
    fieldChanges: { type: [fieldChangeSchema], default: [] },
    details: { type: mongoose.Schema.Types.Mixed },
    changes: { type: [fieldChangeSchema], default: [] },
    summary: String,
    notes: String,
  },
  { timestamps: true }
);

assetLogSchema.index({ assetId: 1, createdAt: -1 });
assetLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('AssetLog', assetLogSchema);
