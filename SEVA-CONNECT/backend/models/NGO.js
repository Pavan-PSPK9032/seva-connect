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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ngoSchema.index({ verified: 1 });
ngoSchema.index({ causes: 1 });
ngoSchema.index({ organizationName: 1 });

module.exports = mongoose.model('NGO', ngoSchema);