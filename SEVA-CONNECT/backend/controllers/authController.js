/**
 * Authentication controllers — registration with email OTP verification,
 * login, logout/session invalidation, and password recovery.
 *
 * Passwords are hashed by the User model before save; tokens are signed JWTs.
 * OTPs are generated and hashed in services/otpService.js and are never
 * returned in a response, written to logs, or sent to the browser.
 */
const crypto = require('crypto');
const User = require('../models/User');
const signToken = require('../utils/generateToken');
const { normalizeEmail, isEmailVerified } = require('../utils/email');
const { sendMail, smtpConfigured } = require('../services/mailer');
const { issueOtp, verifyOtp } = require('../services/otpService');
const { notify } = require('../services/notificationService');
const { getPlatformSettings } = require('../services/settingsService');

const DUPLICATE_EMAIL_MESSAGE =
  'An account with this email already exists. Please log in or reset your password.';

const GENERIC_RESEND_MESSAGE =
  'If that address still needs verification, a new code has been sent.';

function verificationPayload(email, extra = {}) {
  return {
    success: true,
    verificationRequired: true,
    email,
    expiresInSeconds: 5 * 60,
    resendAfterSeconds: 60,
    ...extra,
  };
}

/**
 * Map otpService.issueOtp statuses onto HTTP responses. Shared by registration
 * and resend so both behave identically.
 *
 * Returns a response body, or null when the OTP was sent.
 */
function deliveryErrorResponse(status) {
  if (status === 'cooldown') {
    return {
      status: 429,
      body: {
        success: false,
        code: 'OTP_COOLDOWN',
        message: 'Please wait before requesting another code.',
      },
    };
  }
  if (status === 'rate_limited') {
    return {
      status: 429,
      body: {
        success: false,
        code: 'OTP_RATE_LIMITED',
        message: 'Too many verification codes requested. Please try again later.',
      },
    };
  }
  if (status === 'delivery_failed') {
    return {
      status: 503,
      body: {
        success: false,
        code: 'EMAIL_DELIVERY_FAILED',
        message:
          'We could not send the verification email right now. Please try again in a few minutes.',
      },
    };
  }
  return null;
}

// POST /api/auth/register
// Inputs are pre-validated by express-validator in the route (email format,
// password length, role whitelist volunteer/ngo only — admin is never public).
async function register(req, res, next) {
  try {
    const { name, password, phone, skills, interests, profileImage } = req.body;
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
      // An unverified account is not a dead end: let the client continue to the
      // verification screen instead of telling the person to log in.
      if (!isEmailVerified(existing)) {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_NOT_VERIFIED',
          verificationRequired: true,
          email,
          message:
            'This email is already registered but not verified. Enter the code we emailed you, or request a new one.',
        });
      }
      return res.status(409).json({
        success: false,
        code: 'EMAIL_TAKEN',
        message: DUPLICATE_EMAIL_MESSAGE,
      });
    }

    let user;
    try {
      user = await User.create({
        name,
        email,
        password,
        role: req.body.role || 'volunteer',
        phone: phone || '',
        skills: Array.isArray(skills) ? skills.map((s) => String(s).trim()).filter(Boolean) : [],
        interests: Array.isArray(interests) ? interests.map((s) => String(s).trim()).filter(Boolean) : [],
        profileImage: profileImage || '',
        emailVerified: false,
        termsAcceptedAt: req.body.acceptTerms ? new Date() : null,
      });
    } catch (error) {
      // Two simultaneous requests can both pass the check above; the unique
      // email index then rejects the second insert.
      if (error && error.code === 11000) {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_TAKEN',
          message: DUPLICATE_EMAIL_MESSAGE,
        });
      }
      throw error;
    }

    // `forceCooldown` is false: a brand-new account cannot have a recent send,
    // and the cooldown/rate limits still apply if it somehow does.
    const issued = await issueOtp({ email, user, ip: req.ip });

    if (issued.status !== 'sent') {
      // Never leave a half-registered account behind when the code could not go
      // out: the person would be stuck with an email address they cannot reuse.
      await User.deleteOne({ _id: user._id });
      const failure = deliveryErrorResponse(issued.status);
      if (failure) {
        return res.status(failure.status).json({
          ...failure.body,
          ...(issued.retryAfter ? { retryAfter: issued.retryAfter } : {}),
        });
      }
      return res.status(503).json({
        success: false,
        code: 'EMAIL_DELIVERY_FAILED',
        message:
          'We could not send the verification email right now. Please try again in a few minutes.',
      });
    }

    return res.status(201).json(
      verificationPayload(email, {
        message: 'Account created. Enter the verification code we emailed you.',
      })
    );
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/verify-email
// Atomically consumes the OTP, marks the account verified and issues a token.
async function verifyEmail(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();

    const result = await verifyOtp({ email, otp, purpose: 'registration' });

    if (result.status === 'expired') {
      return res.status(400).json({
        success: false,
        code: 'OTP_EXPIRED',
        message: 'That code has expired. Please request a new one.',
      });
    }

    if (result.status === 'locked') {
      return res.status(429).json({
        success: false,
        code: 'OTP_LOCKED',
        message: 'Too many incorrect attempts. Please request a new code.',
      });
    }

    if (result.status !== 'verified') {
      return res.status(400).json({
        success: false,
        code: 'OTP_INVALID',
        message: 'That code is not valid. Please check it and try again.',
        attemptsRemaining: result.attemptsRemaining,
      });
    }

    // Mark verification exactly once. The conditional update means two parallel
    // successful checks cannot both "complete" a registration.
    const user = await User.findOneAndUpdate(
      { email, emailVerified: { $ne: true } },
      { $set: { emailVerified: true, emailVerifiedAt: new Date() } },
      { new: true }
    );

    // Already verified (for example the same code was replayed after success):
    // treat it as a normal login rather than an error.
    const account = user || (await User.findOne({ email }));

    if (!account) {
      return res.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        message: 'We could not find that registration. Please sign up again.',
      });
    }

    if (account.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account is suspended. Please contact support.',
      });
    }

    const previousLogin = account.lastLoginAt;
    account.lastLoginAt = new Date();
    if (user || !previousLogin) await account.save({ validateBeforeSave: false });

    if (user) {
      void notify({
        recipient: user._id,
        type: 'system',
        title: 'Email verified',
        message: 'Your email address is verified. Welcome to Seva Connect!',
        link: '/dashboard',
      });
    }

    return res.json({
      success: true,
      message: 'Email verified. Welcome to Seva Connect!',
      token: signToken({ id: account._id }, account),
      user: account,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/resend-verification
async function resendVerification(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);

    if (!smtpConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'EMAIL_NOT_CONFIGURED',
        message:
          'Email delivery is not configured on this server, so verification codes cannot be sent yet.',
      });
    }

    const user = await User.findOne({ email });

    // Generic answer for unknown or already-verified addresses so this endpoint
    // cannot be used to enumerate accounts.
    if (!user || isEmailVerified(user)) {
      return res.json({ success: true, message: GENERIC_RESEND_MESSAGE });
    }

    const issued = await issueOtp({ email, user, ip: req.ip });

    if (issued.status === 'sent') {
      return res.json(
        verificationPayload(email, {
          message: 'A new verification code has been sent.',
        })
      );
    }

    const failure = deliveryErrorResponse(issued.status);
    if (failure) {
      return res.status(failure.status).json({
        ...failure.body,
        ...(issued.retryAfter ? { retryAfter: issued.retryAfter } : {}),
      });
    }

    return res.status(503).json({
      success: false,
      code: 'EMAIL_DELIVERY_FAILED',
      message:
        'We could not send the verification email right now. Please try again in a few minutes.',
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
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account is suspended. Please contact support.',
      });
    }

    // Only reveal verification state after the password has been confirmed.
    if (!isEmailVerified(user)) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        verificationRequired: true,
        email: user.email,
        message: 'Please verify your email address before logging in.',
      });
    }

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
  verifyEmail,
  resendVerification,
  login,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
};
