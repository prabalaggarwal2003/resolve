import mongoose from 'mongoose';
import { DEFAULT_REPORT_FORMATTING, DEFAULT_REPORT_STUDIO_SETTINGS } from '../constants/reportStudioDefaults.js';

const defaultFormattingSchema = new mongoose.Schema(
  {
    header: { type: String, default: '' },
    footer: { type: String, default: '' },
    watermark: { type: String, default: '' },
    orientation: { type: String, default: 'landscape' },
    paperSize: { type: String, default: 'a4' },
  },
  { _id: false }
);

const reportStudioSettingsSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    defaultFilenameFormat: {
      type: String,
      default: DEFAULT_REPORT_STUDIO_SETTINGS.defaultFilenameFormat,
    },
    defaultFormatting: {
      type: defaultFormattingSchema,
      default: () => ({ ...DEFAULT_REPORT_FORMATTING }),
    },
    branding: {
      companyName: { type: String, default: '' },
      /** Base64 data URL for the report logo (uploaded file). */
      logoData: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('ReportStudioSettings', reportStudioSettingsSchema);
