/**
 * PlatformSetting — a single document of admin-editable platform configuration.
 *
 * Only settings that actually change platform behaviour live here (registration
 * availability, support address, public banner). Secrets stay in environment
 * variables and are never stored in or returned from this collection.
 */
const mongoose = require('mongoose');

const platformSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'platform',
    unique: true,
    immutable: true,
  },
  platformName: {
    type: String,
    trim: true,
    maxlength: [80, 'Platform name cannot exceed 80 characters'],
    default: 'Seva Connect',
  },
  supportEmail: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [160, 'Support email cannot exceed 160 characters'],
    default: '',
  },
  registrationOpen: {
    type: Boolean,
    default: true,
  },
  maintenanceNotice: {
    type: String,
    trim: true,
    maxlength: [500, 'Maintenance notice cannot exceed 500 characters'],
    default: '',
  },
  announcementBanner: {
    type: String,
    trim: true,
    maxlength: [300, 'Banner text cannot exceed 300 characters'],
    default: '',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);
