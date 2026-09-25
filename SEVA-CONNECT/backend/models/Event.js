/**
 * Event model — volunteering opportunities created by NGOs.
 */
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [120, 'Event title cannot exceed 120 characters'],
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    maxlength: [3000, 'Description cannot exceed 3000 characters'],
  },
  date: {
    type: Date,
    required: [true, 'Event date is required'],
  },
  time: {
    type: String,
    required: [true, 'Event time is required'],
    trim: true,
  },
  location: {
    type: String,
    required: [true, 'Event location is required'],
    trim: true,
  },
  online: {
    type: Boolean,
    default: false,
  },
  causes: {
    type: [String],
    default: [],
  },
  ngoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NGO',
    required: [true, 'Event must belong to an NGO'],
  },
  requiredVolunteers: {
    type: Number,
    default: 20,
    min: [1, 'Capacity must be at least 1'],
  },
  registeredVolunteers: {
    type: Number,
    default: 0,
    min: [0, 'Registered volunteers cannot be negative'],
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

eventSchema.index({ status: 1, date: 1 });
eventSchema.index({ ngoId: 1 });
eventSchema.index({ causes: 1 });

module.exports = mongoose.model('Event', eventSchema);