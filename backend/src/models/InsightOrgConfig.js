import mongoose from 'mongoose';
import { DEFAULT_INSIGHT_THRESHOLDS } from '../constants/insightDefaults.js';

const insightOrgConfigSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    thresholds: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_INSIGHT_THRESHOLDS }),
    },
    notifications: {
      showOnDashboard: { type: Boolean, default: true },
      showInApp: { type: Boolean, default: true },
      maxDashboardItems: { type: Number, default: 20 },
    },
    seededAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('InsightOrgConfig', insightOrgConfigSchema);
