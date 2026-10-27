/**
 * Transactional mail.
 *
 * Provider configuration comes from environment variables only. When SMTP is
 * not configured the transport reports `delivered: false` with
 * `channel: 'unconfigured'`; callers decide how to surface that. Message
 * bodies are deliberately never written to logs because they can contain OTPs
 * and password-reset links.
 */

let cachedTransporter = null;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

function buildTransporter() {
  if (cachedTransporter) return cachedTransporter;

  // Lazily required so the API still boots if nodemailer cannot be loaded.
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return cachedTransporter;
}

/**
 * @returns {Promise<{delivered: boolean, channel: 'smtp'|'unconfigured', error?: string}>}
 */
async function sendMail({ to, subject, text, html }) {
  if (!smtpConfigured()) {
    console.warn(`[MAIL] SMTP is not configured; message to ${to} ("${subject}") was not sent.`);
    return { delivered: false, channel: 'unconfigured', error: 'SMTP is not configured' };
  }

  try {
    const transporter = buildTransporter();
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'Seva Connect <no-reply@sevaconnect.org>',
      to,
      subject,
      text,
      html,
    });
    return { delivered: true, channel: 'smtp' };
  } catch (error) {
    // Never include the message body in the log line.
    console.error(`[MAIL] Delivery to ${to} failed: ${error.message}`);
    return { delivered: false, channel: 'smtp', error: error.message };
  }
}

/**
 * Check that the configured SMTP host accepts our credentials without sending
 * a message. Useful as a deployment check before real registrations arrive.
 * @returns {Promise<{ok: boolean, channel: 'smtp'|'unconfigured', error?: string}>}
 */
async function verifyTransport() {
  if (!smtpConfigured()) {
    return { ok: false, channel: 'unconfigured', error: 'SMTP is not configured' };
  }

  try {
    await buildTransporter().verify();
    return { ok: true, channel: 'smtp' };
  } catch (error) {
    console.error(`[MAIL] SMTP verification failed: ${error.message}`);
    return { ok: false, channel: 'smtp', error: error.message };
  }
}

module.exports = { sendMail, verifyTransport, smtpConfigured };
