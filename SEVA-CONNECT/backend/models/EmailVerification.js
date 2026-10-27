/**
 * EmailVerification — a short-lived, single-use email OTP challenge.
 *
 * Only an HMAC-SHA256 digest of the OTP is stored. The plaintext code exists
 * momentarily in memory so it can be emailed, and is never persisted, returned
 * by an API, or written to logs.
 *
 * A new challenge invalidates any older open challenge for the same address
 * (see services/otpService.js), so a resend can never leave two valid codes.
 */
const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    index: true,
  },
  purpose: {
    type: String,
    enum: ['registration'],
    default: 'registration',
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  otpHash: {
    type: String,
    required: true,
    select: false,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  maxAttempts: {
    type: Number,
    default: 5,
    min: 1,
  },
  sendCount: {
    type: Number,
    default: 1,
    min: 1,
  },
  lastSentAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  consumedAt: {
    type: Date,
    default: null,
  },
  requestIp: {
    type: String,
    trim: true,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Lookup for the newest active challenge for an address.
emailVerificationSchema.index({ email: 1, purpose: 1, consumedAt: 1, createdAt: -1 });
// Mongo removes expired challenges a day after they lapse. Security never
// relies on this TTL: every check also compares expiresAt explicitly.
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('EmailVerification', emailVerificationSchema);
