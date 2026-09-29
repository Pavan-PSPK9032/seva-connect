/**
 * Event controllers.
 * Public:  GET /api/events       — listing (search/filter/pagination)
 * Protected: GET /api/events/mine — events for the caller's NGOs
 *            POST /api/events     — create for own NGO (ngo/admin)
 *            PATCH /api/events/:id — update (owner NGO/admin)
 *            DELETE /api/events/:id — delete (owner NGO/admin)
 */
const Event = require('../models/Event');
const NGO = require('../models/NGO');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function canManageNGO(user, ngo) {
  if (user.role === 'admin') return true;
  return ngo.createdBy && ngo.createdBy.toString() === String(user._id);
}

const populate = { path: 'ngoId', select: 'organizationName verified logo' };

function shapeEvent(ev) {
  const doc = ev.toObject();
  doc.ngoName = doc.ngoId ? doc.ngoId.organizationName : '';
  doc.ngoVerified = doc.ngoId ? doc.ngoId.verified : false;
  doc.ngoLogo = doc.ngoId ? doc.ngoId.logo : '';
  return doc;
}

async function getEvents(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 9));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = { $in: req.query.status.split(',') };
    } else {
      filter.status = { $in: ['upcoming', 'ongoing'] };
    }

    const q = (req.query.q || '').trim();
    if (q) {
      filter.$or = [
        { title: { $regex: escapeRegex(q), $options: 'i' } },
        { description: { $regex: escapeRegex(q), $options: 'i' } },
        { location: { $regex: escapeRegex(q), $options: 'i' } },
        { causes: { $regex: escapeRegex(q), $options: 'i' } },
      ];
    }
    if (req.query.cause) {
      filter.causes = { $regex: `^${escapeRegex(req.query.cause)}$`, $options: 'i' };
    }
    if (req.query.online === 'true') filter.online = true;
    if (req.query.online === 'false') filter.online = false;
    if (req.query.ngoId) filter.ngoId = req.query.ngoId;

    const order = req.query.order === 'desc' ? -1 : 1;

    const [items, total] = await Promise.all([
      Event.find(filter)
        .populate(populate)
        .sort({ date: order })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items.map(shapeEvent),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/events/mine
async function getMyEvents(req, res, next) {
  try {
    const ngos = await NGO.find({ createdBy: req.user._id }).select('_id');
    const ids = ngos.map((n) => n._id);
    const items = await Event.find({ ngoId: { $in: ids } })
      .populate(populate)
      .sort({ date: 1 });
    res.json({ success: true, data: items.map(shapeEvent) });
  } catch (error) {
    next(error);
  }
}

// POST /api/events
async function createEvent(req, res, next) {
  try {
    const { title, description, date, time, location, online, causes, ngoId, requiredVolunteers, status } = req.body;

    const ngo = await NGO.findById(ngoId);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }
    if (!canManageNGO(req.user, ngo)) {
      return res.status(403).json({
        success: false,
        message: 'You can only create events for NGOs you manage.',
      });
    }

    const event = await Event.create({
      title,
      description,
      date,
      time,
      location,
      online: online === true,
      causes: Array.isArray(causes) ? causes.map((c) => String(c).trim()).filter(Boolean) : [],
      ngoId,
      requiredVolunteers: requiredVolunteers || undefined,
      registeredVolunteers: 0,
      status: status || 'upcoming',
    });

    const populated = await Event.findById(event._id).populate(populate);
    return res.status(201).json({ success: true, message: 'Event created.', data: shapeEvent(populated) });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/events/:id
async function updateEvent(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const ngo = await NGO.findById(event.ngoId);
    if (!canManageNGO(req.user, ngo)) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage events for NGOs you own.',
      });
    }

    const { title, description, date, time, location, online, causes, ngoId, requiredVolunteers, status } = req.body;

    if (ngoId && String(ngoId) !== String(event.ngoId)) {
      const target = await NGO.findById(ngoId);
      if (!target) {
        return res.status(404).json({ success: false, message: 'Target NGO not found.' });
      }
      if (!canManageNGO(req.user, target)) {
        return res.status(403).json({
          success: false,
          message: 'You can only move events between NGOs you manage.',
        });
      }
      event.ngoId = ngoId;
    }

    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (date !== undefined) event.date = date;
    if (time !== undefined) event.time = time;
    if (location !== undefined) event.location = location;
    if (online !== undefined) event.online = online === true;
    if (Array.isArray(causes)) event.causes = causes.map((c) => String(c).trim()).filter(Boolean);
    if (requiredVolunteers !== undefined) event.requiredVolunteers = requiredVolunteers;
    if (status !== undefined) event.status = status;

    await event.save();
    const populated = await Event.findById(event._id).populate(populate);
    return res.json({ success: true, message: 'Event updated.', data: shapeEvent(populated) });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/events/:id
async function deleteEvent(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    const ngo = await NGO.findById(event.ngoId);
    if (!canManageNGO(req.user, ngo)) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage events for NGOs you own.',
      });
    }

    await Event.deleteOne({ _id: event._id });
    return res.json({ success: true, message: 'Event removed.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getEvents, getMyEvents, createEvent, updateEvent, deleteEvent };