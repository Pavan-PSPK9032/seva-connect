/**
 * Authentication & authorization middleware.
 *  - protect:      verifies the Bearer JWT and attaches the requesting user.
 *  - authorize:    restricts a route to one or more roles.
 *  - optionalAuth: attaches the user when a valid token is present, but never
 *                  rejects anonymous requests.
 *
 * Every protected request checks three things beyond signature validity:
 *  1. the account still exists;
 *  2. the token was issued after the last logout/password change (tokenVersion);
 *  3. the address is verified and the account is not suspended.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isEmailVerified } = require('../utils/email');

function sessionInvalid(res, message = 'Your session has ended. Please log in again.') {
  return res.status(401).json({ success: false, code: 'SESSION_INVALID', message });
}

function verificationRequired(res, user) {
  return res.status(403).json({
    success: false,
    code: 'EMAIL_NOT_VERIFIED',
    email: user.email,
    message: 'Please verify your email address to continue.',
  });
}

/**
 * Shared checks for a decoded token. Returns `{ user }`, `{ error }` or `{ denied }`.
 */
async function resolveToken(decoded) {
  const user = await User.findById(decoded.id);
  if (!user) return { error: 'ACCOUNT_MISSING' };

  const tokenVersion = typeof decoded.tv === 'number' ? decoded.tv : 0;
  const currentVersion = typeof user.tokenVersion === 'number' ? user.tokenVersion : 0;
  if (tokenVersion !== currentVersion) return { error: 'SESSION_INVALID' };

  if (user.accountStatus === 'suspended') return { denied: 'SUSPENDED', user };
  if (!isEmailVerified(user)) return { denied: 'EMAIL_NOT_VERIFIED', user };

  return { user };
}

async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res
      .status(401)
      .json({ success: false, message: 'Not authorized. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await resolveToken(decoded);

    if (result.error === 'ACCOUNT_MISSING') {
      return res.status(401).json({
        success: false,
        message: 'Account no longer exists. Please log in again.',
      });
    }

    if (result.error === 'SESSION_INVALID') {
      return sessionInvalid(res);
    }

    if (result.denied === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account is suspended. Please contact support.',
      });
    }

    if (result.denied === 'EMAIL_NOT_VERIFIED') {
      return verificationRequired(res, result.user);
    }

    req.user = result.user;
    return next();
  } catch (error) {
    return sessionInvalid(res, 'Invalid or expired session. Please log in again.');
  }
}

// Usage: router.put('/:id', protect, authorize('admin', 'ngo'), handler)
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
    }
    next();
  };

// Usage: router.post('/message', optionalAuth, handler)
// Public routes that behave differently for signed-in visitors (the chatbot).
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await resolveToken(decoded);
    req.user = result.user;
  } catch (error) {
    req.user = undefined;
  }
  next();
}

module.exports = { protect, authorize, optionalAuth };
