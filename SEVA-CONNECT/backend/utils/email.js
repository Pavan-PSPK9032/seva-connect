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

module.exports = { normalizeEmail };
