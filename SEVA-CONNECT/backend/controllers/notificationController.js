/**
 * Notification controllers — the authenticated user's own notifications only.
 * GET   /api/notifications              — paginated list + unread count
 * GET   /api/notifications/unread-count
 * PATCH /api/notifications/:id/read
 * PATCH /api/notifications/read-all
 * GET   /api/notifications/preferences
 * PATCH /api/notifications/preferences
 */
const Notification = require('../models/Notification');

// GET /api/notifications
async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { recipient: req.user._id };
    if (req.query.unread === 'true') filter.read = false;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, read: false }),
    ]);

    return res.json({
      success: true,
      data: items,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/notifications/unread-count
async function unreadCount(req, res, next) {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, read: false });
    return res.json({ success: true, data: { unreadCount: count } });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/notifications/:id/read
async function markRead(req, res, next) {
  try {
    // Scoped to the recipient so one user can never read another's notification.
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { read: true } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );
    return res.json({ success: true, message: 'All notifications marked as read.', modified: result.modifiedCount });
  } catch (error) {
    next(error);
  }
}

// GET /api/notifications/preferences
async function getPreferences(req, res, next) {
  try {
    return res.json({ success: true, data: req.user.notificationPrefs });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/notifications/preferences
async function updatePreferences(req, res, next) {
  try {
    const { inApp, email, reminders } = req.body;
    const prefs = req.user.notificationPrefs || {};

    if (inApp !== undefined) prefs.inApp = Boolean(inApp);
    if (email !== undefined) prefs.email = Boolean(email);
    if (reminders !== undefined) prefs.reminders = Boolean(reminders);

    req.user.notificationPrefs = prefs;
    await req.user.save();

    return res.json({ success: true, message: 'Preferences updated.', data: req.user.notificationPrefs });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, unreadCount, markRead, markAllRead, getPreferences, updatePreferences };
