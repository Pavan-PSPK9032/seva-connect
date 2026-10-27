/**
 * Announcement controllers.
 *
 * Public: GET /api/announcements — active platform notices (audience "all").
 * Admin:  list / create / update / delete under /api/admin/announcements.
 *
 * Publishing is the only transition that notifies users, so editing a live
 * announcement does not spam everyone again.
 */
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { notify } = require('../services/notificationService');
const audit = require('../services/auditService');

function pageArgs(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(60, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/announcements  (public)
async function listPublic(req, res, next) {
  try {
    const now = new Date();
    const items = await Announcement.find({
      status: 'published',
      audience: 'all',
      publishedAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .select('title message link publishedAt expiresAt')
      .sort({ publishedAt: -1 })
      .limit(5)
      .lean();

    return res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/announcements
async function listAdmin(req, res, next) {
  try {
    const { page, limit, skip } = pageArgs(req.query);
    const filter = {};
    if (['draft', 'published', 'archived'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (['all', 'volunteer', 'ngo'].includes(req.query.audience)) {
      filter.audience = req.query.audience;
    }
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), 'i');
      filter.$or = [{ title: rx }, { message: rx }];
    }

    const [items, total] = await Promise.all([
      Announcement.find(filter)
        .populate({ path: 'createdBy', select: 'name email' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Announcement.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

async function notifyAudience(announcement) {
  const filter = {
    accountStatus: { $ne: 'suspended' },
    'notificationPrefs.inApp': { $ne: false },
  };
  if (announcement.audience !== 'all') filter.role = announcement.audience;

  // Cap the fan-out so a large user base cannot tie up a request indefinitely.
  const recipients = await User.find(filter).select('_id').limit(500).lean();

  await Promise.allSettled(
    recipients.map((recipient) =>
      notify({
        recipient: recipient._id,
        type: 'system',
        title: announcement.title,
        message: announcement.message,
        link: announcement.link || '/notifications',
        meta: { announcementId: String(announcement._id) },
      })
    )
  );
}

// POST /api/admin/announcements
async function create(req, res, next) {
  try {
    const { title, message, link, audience, status, expiresAt } = req.body;

    const announcement = await Announcement.create({
      title,
      message,
      link: link || '',
      audience: audience || 'all',
      status: status || 'draft',
      publishedAt: status === 'published' ? new Date() : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user._id,
    });

    if (announcement.status === 'published') {
      await notifyAudience(announcement);
    }

    await audit.record(req, {
      action: `announcement.${announcement.status === 'published' ? 'publish' : 'create'}`,
      entityType: 'Announcement',
      entityId: announcement._id,
      summary: `${announcement.status === 'published' ? 'Published' : 'Created'} "${announcement.title}"`,
    });

    return res.status(201).json({
      success: true,
      message: announcement.status === 'published' ? 'Announcement published.' : 'Announcement saved as draft.',
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/announcements/:id
async function update(req, res, next) {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const previousStatus = announcement.status;
    const { title, message, link, audience, status, expiresAt } = req.body;

    if (title !== undefined) announcement.title = title;
    if (message !== undefined) announcement.message = message;
    if (link !== undefined) announcement.link = link;
    if (audience !== undefined) announcement.audience = audience;
    if (expiresAt !== undefined) announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (status !== undefined) {
      announcement.status = status;
      if (status === 'published' && !announcement.publishedAt) {
        announcement.publishedAt = new Date();
      }
    }

    await announcement.save();

    const newlyPublished = previousStatus !== 'published' && announcement.status === 'published';
    if (newlyPublished) await notifyAudience(announcement);

    await audit.record(req, {
      action: `announcement.${newlyPublished ? 'publish' : announcement.status === 'archived' ? 'archive' : 'update'}`,
      entityType: 'Announcement',
      entityId: announcement._id,
      summary: `Updated "${announcement.title}" (${announcement.status})`,
      meta: { previousStatus, status: announcement.status },
    });

    return res.json({ success: true, message: 'Announcement updated.', data: announcement });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/admin/announcements/:id
async function remove(req, res, next) {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    await audit.record(req, {
      action: 'announcement.delete',
      entityType: 'Announcement',
      entityId: announcement._id,
      summary: `Deleted "${announcement.title}"`,
    });

    return res.json({ success: true, message: 'Announcement deleted.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { listPublic, listAdmin, create, update, remove };
