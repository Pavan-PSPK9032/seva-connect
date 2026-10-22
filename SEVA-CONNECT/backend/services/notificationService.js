/**
 * Notification service.
 *
 * Every notification is persisted first, then pushed over Socket.IO if the
 * recipient happens to be connected. Delivery is best-effort: a failed socket
 * emit must never roll back the database write or break the calling action.
 */
const Notification = require('../models/Notification');
const attachSockets = require('../sockets');

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

    return notification;
  } catch (error) {
    // Notifications are secondary to the action that triggered them.
    console.error('[NOTIFY] Could not persist notification:', error.message);
    return null;
  }
}

module.exports = { notify };
