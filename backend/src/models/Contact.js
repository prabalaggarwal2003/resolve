import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    /** Regular ticket contacts vs employee roster (reporters) — not Users/Roles */
    kind: {
      type: String,
      enum: ['contact', 'employee'],
      default: 'contact',
      index: true,
    },
    /** Unique per org when kind=employee */
    employeeId: { type: String, default: '', trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    company: { type: String, default: '', trim: true },
    role: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true },
    team: { type: String, default: '', trim: true },
    /** How this employee entered the roster — only CSV import gates public report by employee ID */
    source: {
      type: String,
      enum: ['manual', 'import'],
      default: 'manual',
    },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

contactSchema.index({ organizationId: 1, email: 1 });
contactSchema.index({ organizationId: 1, name: 1 });
contactSchema.index({ organizationId: 1, isActive: 1 });
contactSchema.index({ organizationId: 1, kind: 1, isActive: 1 });
/** Sparse unique employeeId per org (only documents with a non-empty employeeId) */
contactSchema.index(
  { organizationId: 1, employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: { employeeId: { $type: 'string', $gt: '' } },
  }
);

export default mongoose.model('Contact', contactSchema);
