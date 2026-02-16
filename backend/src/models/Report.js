import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    reportType: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true
    },
    generatedAt: {
      type: Date,
      default: Date.now
    },
    period: {
      start: { type: Date, required: true },
      end: { type: Date, required: true }
    },
    summary: {
      totalIssuesReported: { type: Number, default: 0 },
      totalAssetsAffected: { type: Number, default: 0 },
      mostReportedAssets: [{
        assetId: String,
        assetName: String,
        assetTag: String,
        issueCount: Number
      }],
      mostReportedLocations: [{
        locationId: String,
        locationName: String,
        issueCount: Number
      }],
      issuesByCategory: [{
        category: String,
        count: Number
      }],
      issuesByStatus: {
        open: { type: Number, default: 0 },
        in_progress: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        cancelled: { type: Number, default: 0 }
      },
      topDepartmentIssues: [{
        departmentId: String,
        departmentName: String,
        issueCount: Number
      }]
    },
    insights: {
      criticalAssets: [{
        assetId: String,
        assetName: String,
        issueCount: Number,
        avgResolutionTime: Number
      }],
      performanceMetrics: {
        avgResolutionTime: Number,
        avgResponseTime: Number,
        resolutionRate: Number
      },
      trends: {
        issuesVsPreviousPeriod: Number,
        resolutionTimeVsPrevious: Number,
        highRiskLocations: [String]
      }
    },
    generatedBy: {
      type: String,
      enum: ['system', 'manual'],
      default: 'system'
    },
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed'],
      default: 'completed'
    }
  },
  { timestamps: true }
);

reportSchema.index({ organizationId: 1, reportType: 1, createdAt: -1 });
reportSchema.index({ generatedAt: -1 });

export default mongoose.model('Report', reportSchema);

