import mongoose from 'mongoose';

const reportEntrySchema = new mongoose.Schema(
  {
    reporterName: { type: String, required: true },
    reporterEmail: { type: String, required: true },
    reporterPhone: String,
    description: { type: String, required: true },
    photos: [{ url: String, uploadedAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true, _id: true }
);

const issueSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true }, // e.g. ISS-2024-001
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional for public reports
    reporterName: String,
    reporterEmail: String,
    reporterPhone: String,
    title: { type: String, required: true },
    description: String,
    category: { type: String, default: 'repair' }, // repair, maintenance, complaint, not_working, damage, other
    status: {
      type: String,
      enum: ['open', 'in_progress', 'completed', 'cancelled'],
      default: 'open',
    },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    photos: [{ url: String, uploadedAt: { type: Date, default: Date.now } }],
    reports: [reportEntrySchema], // grouped reports (same problem, multiple people)
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: Date,
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    mergedFrom: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Issue' }],
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: String,
  },
  { timestamps: true }
);

issueSchema.index({ ticketId: 1 }, { unique: true });
issueSchema.index({ assetId: 1 });
issueSchema.index({ assetId: 1, status: 1, category: 1 });
issueSchema.index({ status: 1 });
issueSchema.index({ assignedTo: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ organizationId: 1 });

export default mongoose.model('Issue', issueSchema);
