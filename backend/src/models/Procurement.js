import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const procurementSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    purchaseId: { type: String, required: true, trim: true },
    purchaseOrderNumber: { type: String, trim: true, default: '' },
    invoiceNumber: { type: String, trim: true, default: '' },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    purchaseDate: { type: Date },
    budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget', index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    amount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },
    lifecycleStage: { type: String, default: 'planned', index: true },
    paymentStatus: { type: String, default: 'unpaid', index: true },
    fundingSourceId: { type: String, default: '' },
    costCenter: { type: String, trim: true, default: '' },
    project: { type: String, trim: true, default: '' },
    dimensions: { type: mongoose.Schema.Types.Mixed, default: {} },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    attachments: [attachmentSchema],
    notes: { type: String, default: '' },
    assetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Asset' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

procurementSchema.index({ organizationId: 1, purchaseId: 1 }, { unique: true });
procurementSchema.index({ organizationId: 1, lifecycleStage: 1 });
procurementSchema.index({ organizationId: 1, budgetId: 1 });

procurementSchema.pre('save', function computeTotal(next) {
  const amount = this.amount || 0;
  const tax = this.tax || 0;
  const discount = this.discount || 0;
  const shipping = this.shipping || 0;
  this.totalCost = Math.max(0, amount + tax - discount + shipping);
  next();
});

export default mongoose.model('Procurement', procurementSchema);
