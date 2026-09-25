/**
 * Signs a JWT for an authenticated user document.
 * The secret always comes from the environment (dotenv) — never hardcoded.
 */
const jwt = require('jsonwebtoken');

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

module.exports = signToken;