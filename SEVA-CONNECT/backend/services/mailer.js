/**
 * Transactional mail.
 *
 * No SMTP provider is wired up by default, so messages are written to the
 * server log in development (and the reset link is surfaced to the API caller
 * only outside production). To deliver real email, set SMTP_HOST / SMTP_PORT /
 * SMTP_USER / SMTP_PASS / MAIL_FROM.
 */
async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.log(`[MAIL] (console transport) to=${to} subject="${subject}"\n${text}`);
    return { delivered: false, channel: 'console' };
  }

  try {
    // Lazily required so the app runs even when nodemailer is not installed.
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'Seva Connect <no-reply@sevaconnect.org>',
      to,
      subject,
      text,
      html,
    });
    return { delivered: true, channel: 'smtp' };
  } catch (error) {
    console.error('[MAIL] delivery failed, falling back to console:', error.message);
    console.log(`[MAIL] to=${to} subject="${subject}"\n${text}`);
    return { delivered: false, channel: 'console' };
  }
}

module.exports = { sendMail };
