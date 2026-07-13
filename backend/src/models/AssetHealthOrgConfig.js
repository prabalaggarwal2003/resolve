import mongoose from 'mongoose';
import { DEFAULT_ASSET_HEALTH_CONFIG } from '../constants/assetHealthDefaults.js';

const assetHealthOrgConfigSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    factors: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_ASSET_HEALTH_CONFIG.factors }),
    },
    thresholds: {
      type: mongoose.Schema.Types.Mixed,
      default: () => JSON.parse(JSON.stringify(DEFAULT_ASSET_HEALTH_CONFIG.thresholds)),
    },
    healthLevels: {
      type: mongoose.Schema.Types.Mixed,
      default: () => [...DEFAULT_ASSET_HEALTH_CONFIG.healthLevels],
    },
    automationRules: {
      type: mongoose.Schema.Types.Mixed,
      default: () => [...DEFAULT_ASSET_HEALTH_CONFIG.automationRules],
    },
    autoUpdateCondition: { type: Boolean, default: true },
    defaultNewAssetCondition: {
      type: String,
      enum: ['excellent', 'good'],
      default: 'excellent',
    },
    seededAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('AssetHealthOrgConfig', assetHealthOrgConfigSchema);
