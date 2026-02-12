import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
  vendorId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  website: String,
  taxId: String,
  paymentTerms: {
    type: String,
    default: 'Net 30'
  },
  category: {
    type: String,
    enum: ['Hardware', 'Software', 'Services', 'Supplies', 'Other'],
    default: 'Other'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Blacklisted'],
    default: 'Active'
  },
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

// Compound index for organization + vendorId
vendorSchema.index({ organizationId: 1, vendorId: 1 }, { unique: true });
vendorSchema.index({ organizationId: 1, name: 1 });
vendorSchema.index({ organizationId: 1, status: 1 });

export default mongoose.model('Vendor', vendorSchema);

