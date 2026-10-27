/**
 * NGO model — organizations registered on the platform.
 */
const mongoose = require('mongoose');

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const ngoSchema = new mongoose.Schema({
  organizationName: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    maxlength: [100, 'Organization name cannot exceed 100 characters'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
  },
  contactEmail: {
    type: String,
    required: [true, 'Contact email is required'],
    lowercase: true,
    trim: true,
    match: [EMAIL_RE, 'Please provide a valid contact email'],
  },
  causes: {
    type: [String],
    default: [],
  },
  website: {
    type: String,
    default: '',
  },
  logo: {
    type: String,
    default: '',
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verificationRequested: {
    type: Boolean,
    default: false,
  },
  verificationNote: {
    type: String,
    trim: true,
    maxlength: [1000, 'Verification note cannot exceed 1000 characters'],
    default: '',
  },
  // Admin approval status - NGO must be approved by admin before users can participate
  approved: {
    type: Boolean,
    default: false,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  // Administrators may suspend an organisation without deleting its records.
  // Accounts and records created before this field existed have no value and
  // are treated as active.
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ngoSchema.index({ verified: 1 });
ngoSchema.index({ status: 1 });
ngoSchema.index({ causes: 1 });
ngoSchema.index({ organizationName: 1 });
ngoSchema.index({ createdBy: 1 });

module.exports = mongoose.model('NGO', ngoSchema);