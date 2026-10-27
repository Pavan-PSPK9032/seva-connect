/**
 * Authentication controllers — registration with email OTP verification,
 * login, logout/session invalidation, and password recovery.
 *
 * Passwords are hashed by the User model before save; tokens are signed JWTs.
 * OTPs are generated and hashed in services/otpService.js and are never
 * returned in a response, written to logs, or sent to the browser.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const EmailVerification = require('../models/EmailVerification');
const signToken = require('../utils/generateToken');
const { normalizeEmail, isEmailVerified } = require('../utils/email');
const { sendMail, smtpConfigured } = require('../services/mailer');
const { issueOtp, verifyOtp } = require('../services/otpService');
const googleAuth = require('../services/googleAuth');
const { notify } = require('../services/notificationService');
const { getPlatformSettings } = require('../services/settingsService');

const BCRYPT_ROUNDS = 10;

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

function cleanList(value, limit = 20) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Build the data that waits with the OTP challenge. The password is hashed
 * here, so even the pending record never contains the plaintext password.
 */
async function buildPendingRegistration(body) {
  return {
    name: String(body.name || '').trim(),
    passwordHash: await bcrypt.hash(String(body.password), BCRYPT_ROUNDS),
    role: body.role === 'ngo' ? 'ngo' : 'volunteer',
    phone: String(body.phone || '').trim(),
    skills: cleanList(body.skills),
    interests: cleanList(body.interests),
    profileImage: String(body.profileImage || '').trim(),
    termsAcceptedAt: body.acceptTerms ? new Date() : null,
  };
}

/**
 * Newest challenge that still carries pending registration data. It is looked
 * up even when consumed, so a resend/recovery after an expired or locked code
 * can reuse the original form data instead of asking for it again.
 */
function findPendingChallenge(email) {
  return EmailVerification.findOne({
    email,
    purpose: 'registration',
    pendingRegistration: { $ne: null },
  }).sort({ createdAt: -1 });
}

/**
 * Create the verified account from the data held by the OTP challenge.
 *
 * The User unique-email index is the final arbiter: if another request wins the
 * race, the duplicate-key error is translated into a sign-in for an unverified
 * record or a clear 409 for an already-verified one. No partially-created user
 * is ever left behind.
 */
async function createAccountFromPending(email, pending) {
  const existing = await User.findOne({ email });

  if (existing) {
    if (isEmailVerified(existing)) return { status: 'taken' };
    const verified = await User.findOneAndUpdate(
      { _id: existing._id, emailVerified: { $ne: true } },
      { $set: { emailVerified: true, emailVerifiedAt: new Date() } },
      { new: true }
    );
    return verified ? { status: 'ok', user: verified, created: false } : { status: 'taken' };
  }

  const user = new User({
    name: pending.name,
    email,
    password: pending.passwordHash,
    role: pending.role === 'ngo' ? 'ngo' : 'volunteer',
    phone: pending.phone || '',
    skills: pending.skills || [],
    interests: pending.interests || [],
    profileImage: pending.profileImage || '',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    termsAcceptedAt: pending.termsAcceptedAt || new Date(),
    authProvider: 'password',
  });
  // The pending record already holds a bcrypt hash; do not hash it twice.
  user.$locals.passwordAlreadyHashed = true;

  try {
    await user.save();
    return { status: 'ok', user, created: true };
  } catch (error) {
    if (!error || error.code !== 11000) throw error;

    // A concurrent verifier (or a Google signup) inserted the address first.
    const raced = await User.findOne({ email });
    if (!raced) throw error;
    if (isEmailVerified(raced)) return { status: 'taken' };

    const verified = await User.findOneAndUpdate(
      { _id: raced._id, emailVerified: { $ne: true } },
      { $set: { emailVerified: true, emailVerifiedAt: new Date() } },
      { new: true }
    );
    return verified ? { status: 'ok', user: verified, created: false } : { status: 'taken' };
  }
}

/** Issue the challenge and turn service statuses into a response. */
async function deliverOtp({ email, pendingRegistration, user, ip, res }) {
  const issued = await issueOtp({ email, pendingRegistration, user, ip });

  if (issued.status === 'sent') return null;

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

// POST /api/auth/register
// Inputs are pre-validated by express-validator in the route (email format,
// password length, role whitelist volunteer/ngo only — admin is never public).
// No User document is created here. The form data travels with the OTP
// challenge and the account is inserted only after the code is verified.
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

    // A pending registration already owns this address until its code expires.
    // Do not overwrite its password or name; route the person to verification
    // (where they can resend) instead.
    const pending = await findPendingChallenge(email);
    if (pending && !pending.consumedAt && pending.expiresAt.getTime() > Date.now()) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        verificationRequired: true,
        email,
        message:
          'This email is already awaiting verification. Enter the code we sent you, or request a new one.',
      });
    }

    const pendingRegistration = await buildPendingRegistration(req.body);

    // issueOtp checks the cooldown/hourly caps before writing anything, and
    // deletes the challenge if SMTP refuses the message. No account is created
    // on any failure path.
    const failed = await deliverOtp({
      email,
      pendingRegistration,
      ip: req.ip,
      res,
    });
    if (failed) return failed;

    return res.status(201).json(
      verificationPayload(email, {
        message:
          'Check your email for a six-digit code. Your account will be created once the code is verified.',
      })
    );
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/verify-email
// Atomically consumes the OTP, creates (or verifies) the account exactly once,
// then issues a token.
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

    let account;
    let created = false;

    if (result.pendingRegistration) {
      const outcome = await createAccountFromPending(email, result.pendingRegistration);
      if (outcome.status === 'taken') {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_TAKEN',
          message: DUPLICATE_EMAIL_MESSAGE,
        });
      }
      account = outcome.user;
      created = outcome.created;
    } else {
      // Legacy flow: the User document already existed (unverified), so only
      // the verification flag has to be flipped.
      const verified = await User.findOneAndUpdate(
        { email, emailVerified: { $ne: true } },
        { $set: { emailVerified: true, emailVerifiedAt: new Date() } },
        { new: true }
      );
      // Already verified (for example the same code was replayed after success):
      // treat it as a normal login rather than an error.
      account = verified || (await User.findOne({ email }));
      created = Boolean(verified);
    }

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

    account.lastLoginAt = new Date();
    await account.save({ validateBeforeSave: false });

    if (created) {
      void notify({
        recipient: account._id,
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

    // Generic answer for unknown, suspended or already-verified addresses so
    // this endpoint cannot be used to enumerate accounts.
    if (user && (isEmailVerified(user) || user.accountStatus === 'suspended')) {
      return res.json({ success: true, message: GENERIC_RESEND_MESSAGE });
    }

    let pendingRegistration = null;
    if (!user) {
      const pending = await findPendingChallenge(email);
      if (!pending) {
        return res.json({ success: true, message: GENERIC_RESEND_MESSAGE });
      }
      pendingRegistration = pending.pendingRegistration
        ? pending.pendingRegistration.toObject()
        : null;
      if (!pendingRegistration) {
        return res.json({ success: true, message: GENERIC_RESEND_MESSAGE });
      }
    }

    const failed = await deliverOtp({
      email,
      user: user || undefined,
      pendingRegistration,
      ip: req.ip,
      res,
    });
    if (failed) return failed;

    return res.json(
      verificationPayload(email, {
        message: 'A new verification code has been sent. Older codes no longer work.',
      })
    );
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

    // Google already verified the address, so no email OTP is required.
    if (!isEmailVerified(user)) {
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
  verifyEmail,
  resendVerification,
  login,
  logout,
  googleSignIn,
  linkGoogle,
  changePassword,
  forgotPassword,
  resetPassword,
};
