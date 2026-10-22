/**
 * Notification model — in-app messages for application and event updates.
 * Emitted over Socket.IO when the recipient is online; always persisted so the
 * bell and the notifications page survive reloads.
 */
const mongoose = require('mongoose');

const TYPES = [
  'application_received',
  'application_approved',
  'application_rejected',
  'application_withdrawn',
  'application_completed',
  'event_updated',
  'event_cancelled',
  'event_reminder',
  'certificate_ready',
  'verification_requested',
  'system',
];

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recipient is required'],
  },
  type: {
    type: String,
    enum: { values: TYPES, message: 'Invalid notification type' },
    default: 'system',
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [120, 'Title cannot exceed 120 characters'],
  },
  message: {
    type: String,
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters'],
    default: '',
  },
  // In-app path the notification links to (e.g. /dashboard or /events/<id>).
  link: {
    type: String,
    trim: true,
    default: '',
  },
  // Set once the recipient opens it; drives the unread badge.
  read: {
    type: Boolean,
    default: false,
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

notificationSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Notification', notificationSchema);
