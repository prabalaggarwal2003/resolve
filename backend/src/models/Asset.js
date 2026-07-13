import mongoose from 'mongoose';

const assetStatusEnum = ['available', 'in_use', 'under_maintenance', 'retired', 'working', 'needs_repair', 'out_of_service'];

const assetSchema = new mongoose.Schema(
  {
    assetId: { type: String, required: true, unique: true }, // e.g. AST-001
    name: { type: String, required: true },
    model: String,
    category: { type: String, required: true }, // type: Projector, Desktop, etc.
    serialNumber: String,
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedToName: { type: String, trim: true },
    assignedToEmployeeCode: { type: String, trim: true },
    assignedAt: Date,
    status: {
      type: String,
      default: 'available',
    },
    tags: [{ type: String, trim: true }],
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetTemplate' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetGroup' },
    depreciationPolicyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DepreciationPolicy' },
    depreciationRateOverride: { type: Number, min: 0, max: 100 },
    depreciationOverrideReason: { type: String, default: '' },
    purchaseDate: Date,
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    purchaseInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget', index: true },
    procurementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Procurement', index: true },
    purchaseOrderNumber: { type: String, trim: true, default: '' },
    invoiceNumber: { type: String, trim: true, default: '' },
    fundingSourceId: { type: String, default: '' },
    costCenter: { type: String, trim: true, default: '' },
    cost: Number,
    warrantyExpiry: Date,
    amcExpiry: Date,
    nextMaintenanceDate: Date,
    photos: [{ url: String, caption: String, uploadedAt: { type: Date, default: Date.now } }],
    documents: [{ url: String, name: String, type: String, uploadedAt: { type: Date, default: Date.now } }],
    qrCodeUrl: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Health monitoring fields
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'critical', 'under_maintenance'],
      default: 'good'
    },
    lastHealthCheck: {
      type: Date,
      default: Date.now
    },
    maintenanceReason: {
      type: String
    },
    maintenanceStartDate: {
      type: Date
    },
    maintenanceCompletedDate: {
      type: Date
    },
    maintenanceHistory: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date },
        reason: { type: String },
        completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        durationMinutes: { type: Number },
        notes: { type: String }
      }
    ]
  },
  { timestamps: true }
);

assetSchema.index({ assetId: 1 }, { unique: true });
assetSchema.index({ serialNumber: 1 });
assetSchema.index({ category: 1 });
assetSchema.index({ locationId: 1 });
assetSchema.index({ status: 1 });
assetSchema.index({ name: 1, locationId: 1 });
assetSchema.index({ model: 1, vendor: 1, purchaseDate: 1 });
assetSchema.index({ assignedTo: 1 });
assetSchema.index({ organizationId: 1 });
assetSchema.index({ groupId: 1 });

export default mongoose.model('Asset', assetSchema);
export { assetStatusEnum };
