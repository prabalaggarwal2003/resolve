import BusinessPartner from './BusinessPartner.js';
import mongoose from 'mongoose';

// Prefer the Vendor alias (same collection) so ref: 'Vendor' populate keeps working.
export default mongoose.models.Vendor || BusinessPartner;
