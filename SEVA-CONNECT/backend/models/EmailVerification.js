/**
 * EmailVerification — a short-lived, single-use email OTP challenge.
 *
 * Only an HMAC-SHA256 digest of the OTP is stored. The plaintext code exists
 * momentarily in memory so it can be emailed, and is never persisted, returned
 * by an API, or written to logs.
 *
 * A new challenge invalidates any older open challenge for the same address
 * (see services/otpService.js), so a resend can never leave two valid codes.
 *
 * For a brand-new registration the account does not exist yet. The form data
 * needed to create it (including an already-hashed password) travels with the
 * challenge and is deleted by Mongo once the challenge expires. The account is
 * only inserted after a successful OTP check.
 */
const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 60, required: true },
    // bcrypt hash produced by the controller; the plaintext password is never
    // stored here (or anywhere else) before verification succeeds.
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['volunteer', 'ngo'], default: 'volunteer' },
    phone: { type: String, trim: true, default: '' },
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    profileImage: { type: String, default: '' },
    termsAcceptedAt: { type: Date, default: null },
  },
  { _id: false }
);

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
  // Present only for registrations where the User document does not exist yet.
  // Legacy unverified accounts keep using `userId` instead.
  pendingRegistration: {
    type: pendingRegistrationSchema,
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

emailVerificationSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.otpHash;
    delete ret.requestIp;
    if (ret.pendingRegistration) delete ret.pendingRegistration.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('EmailVerification', emailVerificationSchema);
