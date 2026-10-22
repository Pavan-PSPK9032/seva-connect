/**
 * Application model — a volunteer's bid to join an event.
 *
 * One volunteer may hold at most one application per event; re-applying after
 * a withdrawal reuses the existing record rather than creating a duplicate.
 * The status lifecycle is:
 *   pending -> approved -> completed
 *   pending -> rejected
 *   pending|approved -> withdrawn
 */
const mongoose = require('mongoose');

const STATUSES = ['pending', 'approved', 'rejected', 'withdrawn', 'completed'];

const applicationSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required'],
  },
  volunteerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Volunteer is required'],
  },
  // Denormalised so an NGO can query all applications it owns in one hit.
  ngoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NGO',
    required: [true, 'NGO is required'],
  },
  status: {
    type: String,
    enum: { values: STATUSES, message: 'Invalid application status' },
    default: 'pending',
  },
  coverNote: {
    type: String,
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters'],
    default: '',
  },
  // Verified hours credited on completion; the basis for certificates.
  hoursCredited: {
    type: Number,
    default: 0,
    min: [0, 'Hours cannot be negative'],
    max: [1000, 'Hours cannot exceed 1000'],
  },
  decidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  decidedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  withdrawnAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Enforces duplicate-application prevention at the database level, so two
// concurrent submits cannot both succeed.
applicationSchema.index({ eventId: 1, volunteerId: 1 }, { unique: true });
applicationSchema.index({ volunteerId: 1, status: 1, createdAt: -1 });
applicationSchema.index({ eventId: 1, status: 1, createdAt: 1 });
applicationSchema.index({ ngoId: 1, status: 1, createdAt: -1 });

applicationSchema.pre('save', function touch(next) {
  this.updatedAt = new Date();
  next();
});

applicationSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Application', applicationSchema);
