/**
 * Seva Connect API — entry point.
 * Connects to MongoDB Atlas, then starts the HTTP server and attaches
 * Socket.IO for real-time notifications.
 */
require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Production safety rails. The pinned OTP code used by automated tests is
// gated by three independent switches (NODE_ENV=test, ALLOW_OTP_TEST_CODE=true
// and a six-digit OTP_TEST_CODE). Refuse to start production with any of them
// present so a copied .env cannot quietly disable email verification.
if (process.env.NODE_ENV === 'production') {
  const suspicious = ['OTP_TEST_CODE', 'ALLOW_OTP_TEST_CODE'].filter(
    (name) => process.env[name]
  );
  if (suspicious.length > 0) {
    console.error(
      `[API] Refusing to start in production with test-only variables: ${suspicious.join(', ')}. ` +
        'Remove them from the production environment.'
    );
    process.exit(1);
  }
}

if (!process.env.SMTP_HOST) {
  console.warn('[API] SMTP_HOST is not set; registration OTP and password reset emails cannot be sent.');
}
if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn('[API] GOOGLE_CLIENT_ID is not set; Google sign-in is disabled.');
}

connectDB().then(() => {
  const server = http.createServer(app);
  require('./sockets')(server);
  server.listen(PORT, () => {
    console.log(`[API] Seva Connect server running on port ${PORT}`);
    console.log(`[API] http://localhost:${PORT}/api/health`);
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('[API] Unhandled rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('[API] Uncaught exception:', err);
  process.exit(1);
});