import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    trim: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  dueDate: Date,
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Cheque', 'Bank Transfer', 'Credit Card', 'Other']
  },
  items: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number,
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset'
    }
  }],
  invoiceFileUrl: String, // URL to uploaded invoice PDF/image
  notes: String,
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Virtual for balance due
invoiceSchema.virtual('balanceDue').get(function() {
  return this.totalAmount - this.paidAmount;
});

// Auto-update status based on payment
invoiceSchema.pre('save', function(next) {
  if (this.paidAmount >= this.totalAmount) {
    this.status = 'Paid';
  } else if (this.dueDate && new Date() > this.dueDate && this.status !== 'Paid') {
    this.status = 'Overdue';
  }
  next();
});

// Compound indexes
invoiceSchema.index({ organizationId: 1, vendorId: 1 });
invoiceSchema.index({ organizationId: 1, invoiceNumber: 1 });
invoiceSchema.index({ organizationId: 1, status: 1 });

export default mongoose.model('Invoice', invoiceSchema);

