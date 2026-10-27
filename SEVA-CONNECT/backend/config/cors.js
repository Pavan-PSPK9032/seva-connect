/**
 * Shared CORS origin configuration used by both the HTTP app and Socket.IO.
 *
 * Origins come from CLIENT_URL (comma separated). When it is unset we fall back
 * to known development origins and the public deployment — never to "reflect
 * any origin", which would let any website call the API with credentials.
 */
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://seva-connect-eta.vercel.app',
];

function getAllowedOrigins() {
  const configured = (process.env.CLIENT_URL || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_ORIGINS;
}

/** Requests without an Origin header (curl, server-to-server) stay allowed. */
function isAllowedOrigin(origin) {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin.replace(/\/+$/, ''));
}

module.exports = { getAllowedOrigins, isAllowedOrigin, DEFAULT_ORIGINS };
