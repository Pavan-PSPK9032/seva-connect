/**
 * Authentication controllers — register, login and password recovery.
 * Passwords are hashed by the User model before save; tokens are signed JWTs.
 */
const crypto = require('crypto');
const User = require('../models/User');
const signToken = require('../utils/generateToken');
const { sendMail } = require('../services/mailer');

// POST /api/auth/register
// Inputs are pre-validated by express-validator in the route (email format,
// password length, role whitelist volunteer/ngo only — admin is never public).
async function register(req, res, next) {
  try {
    const { name, email, password, phone, skills, interests, profileImage } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please log in.',
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: req.body.role || 'volunteer',
      phone: phone || '',
      skills: Array.isArray(skills) ? skills.map((s) => String(s).trim()).filter(Boolean) : [],
      interests: Array.isArray(interests) ? interests.map((s) => String(s).trim()).filter(Boolean) : [],
      profileImage: profileImage || '',
    });

    const token = signToken({ id: user._id });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    // Single generic message so we never reveal whether an email exists.
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'This account is suspended. Please contact support.',
      });
    }

    const token = signToken({ id: user._id });

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res, next) {
  const generic = {
    success: true,
    message: 'If an account exists for that address, a password reset link has been sent.',
  };

  try {
    const email = String(req.body.email || '').toLowerCase();
    const user = await User.findOne({ email });

    // Always answer identically so the endpoint cannot be used to enumerate accounts.
    if (!user) return res.json(generic);

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const base = (
      process.env.CLIENT_URL ||
      (process.env.CORS_ORIGIN || '').split(',')[0] ||
      'http://localhost:5173'
    ).replace(/\/+$/, '');
    const resetUrl = `${base}/reset-password/${rawToken}`;

    await sendMail({
      to: user.email,
      subject: 'Reset your Seva Connect password',
      text: `Hello ${user.name},\n\nUse the link below to choose a new password. It expires in 30 minutes.\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    });

    // Surface the link to developers only; production responses never include it.
    if (process.env.NODE_ENV !== 'production') {
      return res.json({ ...generic, devResetUrl: resetUrl });
    }
    return res.json(generic);
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/reset-password
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ success: true, message: 'Password updated. You can now log in.' });
  } catch (error) {
    next(error);
  }
}
module.exports = { register, login, forgotPassword, resetPassword };
