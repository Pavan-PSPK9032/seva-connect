/**
 * User model — volunteers, NGO admins, and platform admins.
 * Passwords are hashed with bcrypt before save and never serialized to JSON.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { normalizeEmail } = require('../utils/email');

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^\+?[\d\s\-()]{7,20}$/;

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [60, 'Name cannot exceed 60 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    set: normalizeEmail,
    match: [EMAIL_RE, 'Please provide a valid email address'],
  },
  password: {
    type: String,
    // Google-created accounts have no local password; every other account does.
    required: [
      function requiredPassword() {
        return !this.googleId;
      },
      'Password is required',
    ],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // excluded from queries unless explicitly requested
  },
  // Stable Google subject identifier. Sparse and unique so legacy/password
  // accounts without a Google link do not collide with each other.
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    default: undefined,
  },
  authProvider: {
    type: String,
    enum: ['password', 'google'],
    default: 'password',
  },
  lastGoogleLoginAt: {
    type: Date,
    default: null,
  },
  phone: {
    type: String,
    trim: true,
    default: '',
    validate: {
      validator(v) {
        return !v || PHONE_RE.test(v);
      },
      message: 'Please provide a valid phone number',
    },
  },
  skills: {
    type: [String],
    default: [],
  },
  interests: {
    type: [String],
    default: [],
  },
  // Volunteer discovery preferences. Optional so existing accounts keep working.
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters'],
    default: '',
  },
  availability: {
    type: String,
    trim: true,
    maxlength: [120, 'Availability cannot exceed 120 characters'],
    default: '',
  },
  preferredCauses: {
    type: [String],
    default: [],
  },
  savedEvents: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
    },
  ],
  // Let volunteers hide themselves from the public impact leaderboard.
  leaderboardOptOut: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ['volunteer', 'admin', 'ngo'],
    default: 'volunteer',
  },
  // Email verification. New accounts start unverified and cannot use protected
  // features until the emailed OTP is confirmed. Accounts created before this
  // field existed have no value stored at all; because there is deliberately no
  // schema default here, Mongoose keeps them `undefined` and
  // `isEmailVerified()` treats them as verified so existing users keep working.
  // Registration always writes `emailVerified: false` explicitly.
  emailVerified: {
    type: Boolean,
  },
  emailVerifiedAt: {
    type: Date,
    default: null,
  },
  // Recorded when a registrant accepts the terms and privacy policy.
  termsAcceptedAt: {
    type: Date,
    default: null,
  },
  // Bumped on logout / password change to invalidate previously-issued JWTs.
  tokenVersion: {
    type: Number,
    default: 0,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  profileImage: {
    type: String,
    default: '',
  },
  // Admins can suspend an account; suspended users can authenticate but every
  // protected request is refused until reactivated.
  accountStatus: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active',
  },
  notificationPrefs: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    reminders: { type: Boolean, default: true },
  },
  // Password reset — only the SHA-256 hash of the token is persisted, and it is
  // never selected by default so it can never leak through a user payload.
  resetPasswordToken: {
    type: String,
    select: false,
  },
  resetPasswordExpires: {
    type: Date,
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash the password whenever it is set or changed.
userSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) return next();
    // OTP verification transfers a bcrypt hash that was created when the
    // registration form was submitted. Marking the document this way prevents
    // hashing it a second time. This flag is process-local and never persisted.
    if (this.$locals && this.$locals.passwordAlreadyHashed) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare a candidate password against the stored hash. Google-only accounts
// have no hash, so a password attempt simply fails.
userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

// Never expose the password hash or internal fields in JSON/API responses.
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.tokenVersion;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;
    delete ret.googleId;
    delete ret.__v;
    // Expose only whether the provider is linked, never the subject identifier.
    ret.googleLinked = Boolean(doc.googleId);
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);