/**
 * Notification service.
 *
 * Every notification is persisted first, then pushed over Socket.IO if the
 * recipient happens to be connected. Delivery is best-effort: a failed socket
 * emit must never roll back the database write or break the calling action.
 */
const Notification = require('../models/Notification');
const User = require('../models/User');
const attachSockets = require('../sockets');
const { sendMail } = require('./mailer');

/**
 * Send the email copy when the recipient opted in and SMTP is configured.
 * Best-effort and intentionally not awaited: email must never delay or fail
 * the action that produced the notification.
 */
async function maybeEmail({ recipient, title, message, link }) {
  if (!process.env.SMTP_HOST) return;

  try {
    const user = await User.findById(recipient).select('name email notificationPrefs');
    if (!user || !user.notificationPrefs?.email) return;

    const base = (process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/+$/, '');
    const url = link && base ? `${base}${link}` : link;

    await sendMail({
      to: user.email,
      subject: title,
      text: `Hello ${user.name},\n\n${message}${url ? `\n\n${url}` : ''}\n\nYou can change email preferences in your Seva Connect notification settings.`,
    });
  } catch (error) {
    console.warn('[NOTIFY] Email copy failed:', error.message);
  }
}

/**
 * @param {object} params
 * @param {string} params.recipient  User id
 * @param {string} params.type       One of Notification.TYPES
 * @param {string} params.title
 * @param {string} [params.message]
 * @param {string} [params.link]
 * @param {object} [params.meta]
 */
async function notify({ recipient, type, title, message = '', link = '', meta = {} }) {
  if (!recipient) return null;

  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      link,
      meta,
    });

    try {
      const io = typeof attachSockets.getIO === 'function' ? attachSockets.getIO() : null;
      if (io) io.to(`users:${recipient}`).emit('notification:new', notification.toObject());
    } catch (socketError) {
      console.warn('[NOTIFY] Socket emit failed:', socketError.message);
    }

    // Deliberately fire-and-forget; a slow SMTP server must not stall a request.
    void maybeEmail({ recipient, title, message, link });

    return notification;
  } catch (error) {
    // Notifications are secondary to the action that triggered them.
    console.error('[NOTIFY] Could not persist notification:', error.message);
    return null;
  }
}

module.exports = { notify };
