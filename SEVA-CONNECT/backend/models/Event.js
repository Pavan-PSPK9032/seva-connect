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
  // Optional poster image and category for the public listing.
  image: {
    type: String,
    trim: true,
    maxlength: [500, 'Image URL cannot exceed 500 characters'],
    default: '',
  },
  category: {
    type: String,
    trim: true,
    maxlength: [80, 'Category cannot exceed 80 characters'],
    default: '',
  },
  // Contact details and participation instructions shown on the event page.
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [200, 'Contact email cannot exceed 200 characters'],
    default: '',
  },
  contactPhone: {
    type: String,
    trim: true,
    maxlength: [30, 'Contact phone cannot exceed 30 characters'],
    default: '',
  },
  instructions: {
    type: String,
    trim: true,
    maxlength: [2000, 'Instructions cannot exceed 2000 characters'],
    default: '',
  },
  online: {
    type: Boolean,
    default: false,
  },
  causes: {
    type: [String],
    default: [],
  },
  // Skills the organiser is looking for; surfaced on the opportunity page and
  // used by the assistant when recommending roles.
  requiredSkills: {
    type: [String],
    default: [],
  },
  eligibility: {
    type: String,
    trim: true,
    maxlength: [500, 'Eligibility cannot exceed 500 characters'],
    default: '',
  },
  // Last moment a volunteer may apply. Null means "until the event starts".
  applicationDeadline: {
    type: Date,
    default: null,
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
    enum: ['draft', 'pending_approval', 'upcoming', 'ongoing', 'completed', 'cancelled', 'archived'],
    default: 'pending_approval',
  },
  // Admin approval
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'changes_requested'],
    default: 'pending',
  },
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
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    default: '',
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

eventSchema.index({ status: 1, date: 1 });
eventSchema.index({ approvalStatus: 1, status: 1, date: 1 });
eventSchema.index({ ngoId: 1 });
eventSchema.index({ causes: 1 });
eventSchema.index({ category: 1 });

module.exports = mongoose.model('Event', eventSchema);