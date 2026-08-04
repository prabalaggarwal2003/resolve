import mongoose from 'mongoose';
import { DEFAULT_REPORT_STUDIO_SETTINGS } from '../constants/reportStudioDefaults.js';

const reportStudioSettingsSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    defaultExportFormat: {
      type: String,
      default: DEFAULT_REPORT_STUDIO_SETTINGS.defaultExportFormat,
    },
    timezone: { type: String, default: DEFAULT_REPORT_STUDIO_SETTINGS.timezone },
    currency: { type: String, default: DEFAULT_REPORT_STUDIO_SETTINGS.currency },
    defaultFilenameFormat: {
      type: String,
      default: DEFAULT_REPORT_STUDIO_SETTINGS.defaultFilenameFormat,
    },
    retentionDays: { type: Number, default: DEFAULT_REPORT_STUDIO_SETTINGS.retentionDays },
    branding: {
      logoUrl: { type: String, default: '' },
      primaryColor: { type: String, default: '#f59e0b' },
      companyName: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('ReportStudioSettings', reportStudioSettingsSchema);
