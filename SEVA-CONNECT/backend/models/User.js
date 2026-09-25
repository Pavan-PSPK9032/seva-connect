/**
 * User model — volunteers, NGO admins, and platform admins.
 * Passwords are hashed with bcrypt before save and never serialized to JSON.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    match: [EMAIL_RE, 'Please provide a valid email address'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // excluded from queries unless explicitly requested
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
  role: {
    type: String,
    enum: ['volunteer', 'admin', 'ngo'],
    default: 'volunteer',
  },
  profileImage: {
    type: String,
    default: '',
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
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare a candidate password against the stored hash.
userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) {
    throw new Error('User password not loaded — query with .select("+password")');
  }
  return bcrypt.compare(candidate, this.password);
};

// Never expose the password hash or internal fields in JSON/API responses.
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);