/**
 * Certificate — an immutable, shareable record of verified volunteering.
 *
 * Names are snapshotted at issue time so a certificate keeps displaying the
 * details exactly as they were when the contribution was verified, even if an
 * event or organisation is later renamed.
 */
const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  certificateId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
    unique: true,
  },
  volunteerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  ngoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NGO',
    required: true,
  },
  volunteerName: { type: String, required: true, trim: true },
  eventTitle: { type: String, required: true, trim: true },
  ngoName: { type: String, required: true, trim: true },
  eventDate: { type: Date, default: null },
  hours: { type: Number, required: true, min: 0, max: 1000 },
  issuedAt: { type: Date, default: Date.now },
});

certificateSchema.index({ volunteerId: 1, issuedAt: -1 });

module.exports = mongoose.model('Certificate', certificateSchema);
