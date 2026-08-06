import mongoose from 'mongoose';

const optionItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    color: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const relationshipTypeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    resourceType: { type: String, default: '' },
  },
  { _id: false }
);

const customFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'select', 'multiselect', 'textarea', 'currency'],
      default: 'text',
    },
    required: { type: Boolean, default: false },
    options: [String],
    section: { type: String, default: 'custom' },
  },
  { _id: false }
);

const kpiSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    unit: { type: String, default: 'count' },
    higherIsBetter: { type: Boolean, default: true },
    isBuiltin: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const widgetCatalogSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    kind: { type: String, default: 'metric' },
  },
  { _id: false }
);

const businessPartnerOrgConfigSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    partnerTypes: [optionItemSchema],
    categories: [optionItemSchema],
    statuses: [optionItemSchema],
    profileSections: [sectionSchema],
    addressTypes: [optionItemSchema],
    assetRelationshipTypes: [relationshipTypeSchema],
    serviceRelationshipTypes: [relationshipTypeSchema],
    customFields: [customFieldSchema],
    performanceKpis: [kpiSchema],
    dashboardWidgetCatalog: [widgetCatalogSchema],
    settings: {
      partnerCodePrefix: { type: String, default: 'BP' },
      defaultCurrency: { type: String, default: 'INR' },
      defaultPaymentTerms: { type: String, default: 'Net 30' },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('BusinessPartnerOrgConfig', businessPartnerOrgConfigSchema);
