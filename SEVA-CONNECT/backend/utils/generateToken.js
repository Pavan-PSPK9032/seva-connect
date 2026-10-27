/**
 * Signs a JWT for an authenticated user document.
 * The secret always comes from the environment (dotenv) — never hardcoded.
 *
 * `tv` mirrors the user's `tokenVersion`. Incrementing tokenVersion (logout,
 * password change, "sign out of all devices") invalidates every token that was
 * issued before the change, without needing a server-side session store.
 */
const jwt = require('jsonwebtoken');

function signToken(payload, user) {
  const body = { ...payload };
  if (user && typeof user.tokenVersion === 'number') body.tv = user.tokenVersion;
  return jwt.sign(body, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

module.exports = signToken;
