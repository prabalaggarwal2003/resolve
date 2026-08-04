import mongoose from 'mongoose';

const reportExportSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportDefinition' },
    reportName: { type: String, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    format: { type: String, required: true },
    recordCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['completed', 'failed', 'expired'],
      default: 'completed',
    },
    error: { type: String, default: '' },
    fileName: { type: String, default: '' },
    contentType: { type: String, default: '' },
    /** Inline payload for re-download (small/medium exports). Large files can move to object storage later. */
    payload: { type: String, default: '' },
    configSnapshot: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

reportExportSchema.index({ organizationId: 1, createdAt: -1 });
reportExportSchema.index({ organizationId: 1, reportName: 1 });

export default mongoose.model('ReportExport', reportExportSchema);
