import mongoose from 'mongoose';

const reportScheduleSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportDefinition', required: true },
    name: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    enabled: { type: Boolean, default: true },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly',
    },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    dayOfMonth: { type: Number, min: 1, max: 28 },
    timeOfDay: { type: String, default: '09:00' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    exportFormat: { type: String, default: 'csv' },
    recipients: [{ type: String }],
    lastRunAt: Date,
    lastStatus: { type: String, enum: ['success', 'failed', 'pending', null], default: null },
    lastError: { type: String, default: '' },
    nextRunAt: Date,
  },
  { timestamps: true }
);

reportScheduleSchema.index({ organizationId: 1, enabled: 1 });

export default mongoose.model('ReportSchedule', reportScheduleSchema);
