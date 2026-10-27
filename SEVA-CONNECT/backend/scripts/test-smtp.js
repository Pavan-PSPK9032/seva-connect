/**
 * SMTP setup check.
 *
 *   npm run mail:test                      # verify host + credentials only
 *   npm run mail:test -- you@example.com   # send a real test message
 *
 * Reads the same environment variables as the API (backend/.env). It never
 * prints SMTP_USER or SMTP_PASS. Exit code is non-zero when mail cannot be
 * delivered, so it can be used as a deployment gate.
 */
require('dotenv').config();
const { sendMail, verifyTransport, smtpConfigured } = require('../services/mailer');

function configSummary() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;
  return [
    `host=${process.env.SMTP_HOST}`,
    `port=${port}`,
    `secure=${secure}`,
    `auth=${process.env.SMTP_USER ? 'yes' : 'none'}`,
    `from=${process.env.MAIL_FROM || 'Seva Connect <no-reply@sevaconnect.org> (default)'}`,
  ].join(' ');
}

async function main() {
  if (!smtpConfigured()) {
    console.error(
      [
        '[MAIL] SMTP is not configured, so registration OTPs cannot be delivered.',
        'Add these to backend/.env (never commit the file):',
        '  SMTP_HOST=smtp.example.com',
        '  SMTP_PORT=587',
        '  SMTP_USER=...',
        '  SMTP_PASS=...',
        '  MAIL_FROM="Seva Connect <no-reply@yourdomain.org>"',
        'See DEPLOYMENT.md section 1 for provider examples.',
      ].join('\n')
    );
    process.exit(1);
  }

  console.log(`[MAIL] Checking ${configSummary()}`);

  const verification = await verifyTransport();
  if (!verification.ok) {
    console.error(`[MAIL] Could not authenticate with the SMTP server: ${verification.error}`);
    console.error('[MAIL] Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER and SMTP_PASS.');
    process.exit(1);
  }

  console.log('[MAIL] SMTP host and credentials are valid.');

  const to = process.argv[2];
  if (!to) {
    console.log('[MAIL] No recipient given, so no message was sent.');
    console.log('[MAIL] To send a real test: npm run mail:test -- you@example.com');
    return;
  }

  const result = await sendMail({
    to,
    subject: 'Seva Connect SMTP test',
    text: 'If you can read this, Seva Connect can deliver transactional email. No code is included in this message.',
  });

  if (!result.delivered) {
    console.error(`[MAIL] Test message was not delivered: ${result.error}`);
    process.exit(1);
  }

  console.log(`[MAIL] Test message accepted by the SMTP server for ${to}.`);
  console.log('[MAIL] If it does not arrive, check spam and the provider delivery log.');
}

main().catch((error) => {
  console.error(`[MAIL] Unexpected failure: ${error.message}`);
  process.exit(1);
});
