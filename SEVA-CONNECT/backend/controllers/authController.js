/**
 * Authentication controllers — direct registration, login, logout/session
 * invalidation, and password recovery.
 *
 * Passwords are hashed by the User model before save; tokens are signed JWTs.
 * New accounts are created immediately; there is no email OTP step.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const signToken = require('../utils/generateToken');
const { normalizeEmail } = require('../utils/email');
const { sendMail, smtpConfigured } = require('../services/mailer');
const googleAuth = require('../services/googleAuth');
const { notify } = require('../services/notificationService');
const { getPlatformSettings } = require('../services/settingsService');

const BCRYPT_ROUNDS = 10;

const DUPLICATE_EMAIL_MESSAGE =
  'An account with this email already exists. Please log in or reset your password.';

function cleanList(value, limit = 20) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, limit);
}

// POST /api/auth/register
// Direct registration without email verification
async function register(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);

    const settings = await getPlatformSettings();
    if (settings.registrationOpen === false) {
      return res.status(403).json({
        success: false,
        code: 'REGISTRATION_CLOSED',
        message:
          settings.maintenanceNotice ||
          'New registrations are temporarily closed. Please try again later.',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_TAKEN',
        message: DUPLICATE_EMAIL_MESSAGE,
      });
    }

    const user = new User({
      name: String(req.body.name || '').trim(),
      email,
      password: String(req.body.password),
      role: req.body.role === 'ngo' ? 'ngo' : 'volunteer',
      phone: String(req.body.phone || '').trim(),
      skills: Array.isArray(req.body.skills) ? req.body.skills.filter(Boolean) : cleanList(req.body.skills),
      interests: Array.isArray(req.body.interests) ? req.body.interests.filter(Boolean) : cleanList(req.body.interests),
      emailVerified: true,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: req.body.acceptTerms ? new Date() : null,
      authProvider: 'password',
    });

    await user.save();

    const token = signToken(user._id);

    return res.status(201).json({
      success: true,
      token,
      user,
      message: 'Account created successfully.',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    const user = await User.findOne({ email }).select('+password');
    // Single generic message so we never reveal whether an email exists. A
    // Google-only account has no password hash, so a password attempt fails
    // exactly like an unknown address; the message still points people to the
    // right method without confirming an account.
    if (!user || !user.password || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message:
          'Invalid email or password. If you signed up with Google, use “Continue with Google”.',
      });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account is suspended. Please contact support.',
      });
    }

    // Only reveal verification state after the password has been confirmed.
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      token: signToken({ id: user._id }, user),
      user,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/google
// Verifies a Google Identity Services ID token and signs in or creates a
// volunteer account. Email/password accounts are never auto-linked by email.
async function googleSignIn(req, res, next) {
  try {
    if (!googleAuth.googleConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'GOOGLE_NOT_CONFIGURED',
        message: 'Google sign-in is not configured on this server yet.',
      });
    }

    const verification = await googleAuth.verifyGoogleIdToken(req.body.credential, {
      nonce: req.body.nonce,
    });

    if (verification.status === 'unconfigured') {
      return res.status(503).json({
        success: false,
        code: 'GOOGLE_NOT_CONFIGURED',
        message: 'Google sign-in is not configured on this server yet.',
      });
    }

    if (verification.status === 'expired') {
      return res.status(401).json({
        success: false,
        code: 'GOOGLE_TOKEN_EXPIRED',
        message: 'Your Google sign-in expired. Please try again.',
      });
    }

    if (verification.status === 'email_unverified') {
      return res.status(403).json({
        success: false,
        code: 'GOOGLE_EMAIL_UNVERIFIED',
        message: 'Google has not verified this email address, so it cannot be used to sign in.',
      });
    }

    if (verification.status !== 'ok') {
      return res.status(401).json({
        success: false,
        code: 'GOOGLE_INVALID_CREDENTIAL',
        message: 'Google sign-in could not be verified. Please try again.',
      });
    }

    const { sub, email, name, picture } = verification.profile;

    let user = await User.findOne({ googleId: sub });
    let isNewUser = false;

    if (!user) {
      const existing = await User.findOne({ email });

      if (existing) {
        if (existing.googleId && existing.googleId !== sub) {
          return res.status(409).json({
            success: false,
            code: 'GOOGLE_ACCOUNT_CONFLICT',
            message:
              'This email is already linked to a different Google account. Sign in with your password or contact support.',
          });
        }

        // Never link a Google identity to a password account just because the
        // email matches. The person must first prove they control the account
        // (password login), then link Google from their profile.
        return res.status(409).json({
          success: false,
          code: 'GOOGLE_LINK_REQUIRED',
          message:
            'An account with this email already exists. Log in with your password, then link Google from your profile.',
        });
      }

      try {
        user = await User.create({
          name,
          email,
          googleId: sub,
          authProvider: 'google',
          profileImage: picture || '',
          role: 'volunteer', // Google signup can never grant admin or NGO rights
          emailVerified: true,
          emailVerifiedAt: new Date(),
          termsAcceptedAt: req.body.acceptTerms ? new Date() : null,
        });
        isNewUser = true;
      } catch (error) {
        if (!error || error.code !== 11000) throw error;

        // Concurrent Google or email registration won the insert race.
        const raced = await User.findOne({ $or: [{ googleId: sub }, { email }] });
        if (!raced) throw error;

        if (raced.googleId === sub) {
          user = raced;
        } else if (raced.googleId) {
          return res.status(409).json({
            success: false,
            code: 'GOOGLE_ACCOUNT_CONFLICT',
            message:
              'This email is already linked to a different Google account. Sign in with your password or contact support.',
          });
        } else {
          return res.status(409).json({
            success: false,
            code: 'GOOGLE_LINK_REQUIRED',
            message:
              'An account with this email already exists. Log in with your password, then link Google from your profile.',
          });
        }
      }
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account is suspended. Please contact support.',
      });
    }

    if (user.googleId !== sub) {
      return res.status(409).json({
        success: false,
        code: 'GOOGLE_LINK_REQUIRED',
        message:
          'An account with this email already exists. Log in with your password, then link Google from your profile.',
      });
    }

    // Google already verified the address.
    if (user.emailVerified !== true) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
    }

    user.lastLoginAt = new Date();
    user.lastGoogleLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      message: isNewUser ? 'Account created with Google.' : 'Logged in with Google.',
      token: signToken({ id: user._id }, user),
      user,
      isNewUser,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/google/link  (protect)
// Requires an authenticated session, so the caller has already proved account
// ownership with their password. The Google email must match the account email.
async function linkGoogle(req, res, next) {
  try {
    if (!googleAuth.googleConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'GOOGLE_NOT_CONFIGURED',
        message: 'Google sign-in is not configured on this server yet.',
      });
    }

    const verification = await googleAuth.verifyGoogleIdToken(req.body.credential, {
      nonce: req.body.nonce,
    });

    if (verification.status !== 'ok') {
      const expired = verification.status === 'expired';
      return res.status(expired ? 401 : 400).json({
        success: false,
        code: expired ? 'GOOGLE_TOKEN_EXPIRED' : 'GOOGLE_INVALID_CREDENTIAL',
        message: 'Google sign-in could not be verified. Please try again.',
      });
    }

    const { sub, email } = verification.profile;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (normalizeEmail(user.email) !== email) {
      return res.status(409).json({
        success: false,
        code: 'GOOGLE_EMAIL_MISMATCH',
        message:
          'The Google account email must match your Seva Connect email address before it can be linked.',
      });
    }

    if (user.googleId && user.googleId !== sub) {
      return res.status(409).json({
        success: false,
        code: 'GOOGLE_ACCOUNT_CONFLICT',
        message: 'A different Google account is already linked to this profile.',
      });
    }

    const alreadyLinked = user.googleId === sub;

    const other = await User.findOne({ googleId: sub, _id: { $ne: user._id } });
    if (other) {
      return res.status(409).json({
        success: false,
        code: 'GOOGLE_ACCOUNT_CONFLICT',
        message: 'This Google account is already linked to another Seva Connect profile.',
      });
    }

    user.googleId = sub;
    user.lastGoogleLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      message: alreadyLinked ? 'Google account already linked.' : 'Google account linked.',
      user,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/logout  (protect)
// Bumps tokenVersion, invalidating the caller's token and every other session.
async function logout(req, res, next) {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $inc: { tokenVersion: 1 } }
    );
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
}

// PUT /api/auth/password  (protect)
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(400).json({
        success: false,
        code: 'CURRENT_PASSWORD_INVALID',
        message: 'Your current password is incorrect.',
      });
    }

    user.password = newPassword;
    // Invalidate every other session; the caller receives a fresh token below.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    return res.json({
      success: true,
      message: 'Password updated.',
      token: signToken({ id: user._id }, user),
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
    if (!smtpConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'EMAIL_NOT_CONFIGURED',
        message:
          'Email delivery is not configured on this server, so password reset emails cannot be sent yet.',
      });
    }

    const email = normalizeEmail(req.body.email);
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
    ).split(',')[0].trim().replace(/\/+$/, '');
    const resetUrl = `${base}/reset-password/${rawToken}`;

    const delivery = await sendMail({
      to: user.email,
      subject: 'Reset your Seva Connect password',
      text: `Hello ${user.name},\n\nUse the link below to choose a new password. It expires in 30 minutes.\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    });

    if (!delivery.delivered) {
      // Do not claim success when the mail server rejected the message. The
      // token stays valid so the person can retry without requesting a new one.
      return res.status(503).json({
        success: false,
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'We could not send the reset email right now. Please try again shortly.',
      });
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
    // Sign out every existing session after a password reset.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    return res.json({ success: true, message: 'Password updated. You can now log in.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  logout,
  googleSignIn,
  linkGoogle,
  changePassword,
  forgotPassword,
  resetPassword,
};
