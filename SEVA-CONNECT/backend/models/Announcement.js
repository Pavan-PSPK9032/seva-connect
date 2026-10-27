/**
 * Announcement — platform-wide notices managed from the admin panel.
 *
 * Drafts are private. Published announcements appear on the public home page
 * (audience "all") until they expire or are archived.
 */
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [120, 'Title cannot exceed 120 characters'],
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters'],
  },
  link: {
    type: String,
    trim: true,
    maxlength: [300, 'Link cannot exceed 300 characters'],
    default: '',
  },
  audience: {
    type: String,
    enum: ['all', 'volunteer', 'ngo'],
    default: 'all',
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  },
  publishedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
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

announcementSchema.index({ status: 1, publishedAt: -1 });
announcementSchema.index({ audience: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
