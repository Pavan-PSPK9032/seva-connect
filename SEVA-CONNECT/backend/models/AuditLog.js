/**
 * AuditLog model — an append-only trail of privileged actions.
 *
 * Recording who changed what, and when, is what makes admin and NGO decisions
 * reviewable after the fact. Entries are never updated or deleted by the app.
 */
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  actorName: {
    type: String,
    trim: true,
    default: '',
  },
  actorRole: {
    type: String,
    enum: ['volunteer', 'ngo', 'admin'],
    default: 'volunteer',
  },
  action: {
    type: String,
    required: true,
    trim: true,
    // e.g. "application.approve", "ngo.verify", "event.delete"
  },
  entityType: {
    type: String,
    required: true,
    trim: true,
    // e.g. "Application", "NGO", "Event", "User"
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  summary: {
    type: String,
    trim: true,
    maxlength: [300, 'Summary cannot exceed 300 characters'],
    default: '',
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ip: {
    type: String,
    trim: true,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
