/**
 * Canonical email normalisation shared by the auth controllers.
 *
 * Route-level validators already run express-validator's `normalizeEmail()`
 * (which also strips Gmail dots). This helper guarantees the same final shape
 * before every database lookup and save, so a value can never be stored in a
 * different case than the one used to check for duplicates.
 */
function normalizeEmail(value) {
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}

/**
 * Whether an account may use protected features.
 *
 * Accounts created before email verification existed have no `emailVerified`
 * value at all. They are treated as verified so the upgrade never locks out
 * existing users; only an explicit `false` blocks access.
 */
function isEmailVerified(user) {
  return Boolean(user) && user.emailVerified !== false;
}

module.exports = { normalizeEmail, isEmailVerified };
