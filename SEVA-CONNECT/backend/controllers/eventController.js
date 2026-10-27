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
const Application = require('../models/Application');
const { notify } = require('../services/notificationService');
const audit = require('../services/auditService');

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
        { requiredSkills: { $regex: escapeRegex(q), $options: 'i' } },
      ];
    }
    if (req.query.cause) {
      filter.causes = { $regex: `^${escapeRegex(req.query.cause)}$`, $options: 'i' };
    }
    if (req.query.skill) {
      filter.requiredSkills = { $regex: escapeRegex(String(req.query.skill).trim()), $options: 'i' };
    }
    if (req.query.online === 'true') filter.online = true;
    if (req.query.online === 'false') filter.online = false;
    if (req.query.ngoId) filter.ngoId = req.query.ngoId;
    if (req.query.hasSeats === 'true') {
      filter.$expr = { $lt: ['$registeredVolunteers', '$requiredVolunteers'] };
    }

    const order = req.query.order === 'desc' ? -1 : 1;
    let sort = { date: order };
    if (req.query.sort === 'newest') sort = { createdAt: -1 };
    if (req.query.sort === 'deadline') sort = { applicationDeadline: 1, date: 1 };
    if (req.query.sort === 'popular') sort = { registeredVolunteers: -1, date: 1 };

    const [items, total] = await Promise.all([
      Event.find(filter)
        .populate(populate)
        .sort(sort)
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

// GET /api/events/:id
async function getEvent(req, res, next) {
  try {
    const event = await Event.findById(req.params.id).populate({
      path: 'ngoId',
      select: 'organizationName description verified logo location website contactEmail causes',
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const doc = shapeEvent(event);
    if (event.ngoId) {
      doc.ngo = {
        _id: event.ngoId._id,
        organizationName: event.ngoId.organizationName,
        description: event.ngoId.description,
        verified: event.ngoId.verified,
        logo: event.ngoId.logo,
        location: event.ngoId.location,
        website: event.ngoId.website,
        contactEmail: event.ngoId.contactEmail,
        causes: event.ngoId.causes,
      };
    }

    const relatedFilter = {
      _id: { $ne: event._id },
      status: { $in: ['upcoming', 'ongoing'] },
    };
    if (event.causes && event.causes.length) relatedFilter.causes = { $in: event.causes };

    const related = await Event.find(relatedFilter)
      .populate(populate)
      .sort({ date: 1 })
      .limit(3);

    doc.related = related.map(shapeEvent);

    return res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
}

// GET /api/events/recommended
// Ranks live opportunities against the volunteer's saved skills, interests and
// preferred causes. Never returns invented events or scores.
async function getRecommended(req, res, next) {
  try {
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({ success: false, message: 'Recommendations are for volunteer accounts.' });
    }

    const [events, applied] = await Promise.all([
      Event.find({ status: { $in: ['upcoming', 'ongoing'] } }).populate(populate).limit(120),
      Application.find({
        volunteerId: req.user._id,
        status: { $in: ['pending', 'approved', 'completed'] },
      }).select('eventId'),
    ]);

    const appliedIds = new Set(applied.map((application) => String(application.eventId)));
    const interests = new Set(
      [...(req.user.interests || []), ...(req.user.preferredCauses || [])].map((value) =>
        String(value).toLowerCase()
      )
    );
    const skills = new Set((req.user.skills || []).map((value) => String(value).toLowerCase()));

    const scored = events
      .filter((event) => !appliedIds.has(String(event._id)))
      .map((event) => {
        const causes = (event.causes || []).filter((cause) => interests.has(String(cause).toLowerCase()));
        const skillMatches = (event.requiredSkills || []).filter((skill) =>
          skills.has(String(skill).toLowerCase())
        );
        const matchScore = causes.length * 2 + skillMatches.length * 3;
        return {
          ...shapeEvent(event),
          matchScore,
          matchReasons: [
            ...causes.map((cause) => `Cause: ${cause}`),
            ...skillMatches.map((skill) => `Skill: ${skill}`),
          ],
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore || new Date(a.date) - new Date(b.date))
      .slice(0, 6);

    return res.json({
      success: true,
      data: scored,
      note: 'Ranked only from your saved skills, interests and preferred causes.',
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
    if (ngo.status === 'suspended' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'This organisation is suspended and cannot create new activities.',
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
      requiredSkills: Array.isArray(req.body.requiredSkills)
        ? req.body.requiredSkills.map((s) => String(s).trim()).filter(Boolean)
        : [],
      eligibility: req.body.eligibility || '',
      applicationDeadline: req.body.applicationDeadline || null,
      ngoId,
      requiredVolunteers: requiredVolunteers || undefined,
      registeredVolunteers: 0,
      status: status || 'upcoming',
    });

    const populated = await Event.findById(event._id).populate(populate);

    await audit.record(req, {
      action: 'event.create',
      entityType: 'Event',
      entityId: event._id,
      summary: `Created "${event.title}"`,
      meta: { ngoId: String(event.ngoId), status: event.status },
    });

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

    const previous = {
      status: event.status,
      date: event.date ? new Date(event.date).toISOString() : null,
      time: event.time,
      location: event.location,
    };

    const ngo = await NGO.findById(event.ngoId);
    if (!canManageNGO(req.user, ngo)) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage events for NGOs you own.',
      });
    }
    if (ngo.status === 'suspended' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'This organisation is suspended and its activities are read-only.',
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
    if (Array.isArray(req.body.requiredSkills)) {
      event.requiredSkills = req.body.requiredSkills.map((s) => String(s).trim()).filter(Boolean);
    }
    if (req.body.eligibility !== undefined) event.eligibility = req.body.eligibility;
    if (req.body.applicationDeadline !== undefined) {
      event.applicationDeadline = req.body.applicationDeadline || null;
    }
    if (requiredVolunteers !== undefined) event.requiredVolunteers = requiredVolunteers;
    if (status !== undefined) event.status = status;

    await event.save();

    const current = {
      date: event.date ? new Date(event.date).toISOString() : null,
      time: event.time,
      location: event.location,
    };
    const scheduleChanged =
      current.date !== previous.date ||
      current.time !== previous.time ||
      current.location !== previous.location;

    if (previous.status !== 'cancelled' && event.status === 'cancelled') {
      // Cancelling an opportunity releases approved seats and closes every
      // still-open application, notifying each volunteer exactly once.
      const affected = await Application.find({
        eventId: event._id,
        status: { $in: ['pending', 'approved'] },
      }).select('volunteerId status');

      const approvedCount = affected.filter((application) => application.status === 'approved').length;

      await Application.updateMany(
        { eventId: event._id, status: { $in: ['pending', 'approved'] } },
        { $set: { status: 'cancelled', decidedBy: req.user._id, decidedAt: new Date() } }
      );

      if (approvedCount > 0) {
        await Event.updateOne({ _id: event._id }, [
          {
            $set: {
              registeredVolunteers: {
                $max: [0, { $subtract: ['$registeredVolunteers', approvedCount] }],
              },
            },
          },
        ]);
      }

      await Promise.all(
        affected.slice(0, 200).map((application) =>
          notify({
            recipient: application.volunteerId,
            type: 'event_cancelled',
            title: 'Opportunity cancelled',
            message: `"${event.title}" was cancelled by the organiser. Your application has been closed.`,
            link: `/events/${event._id}`,
            meta: { eventId: String(event._id) },
          })
        )
      );
    } else if (scheduleChanged) {
      const affected = await Application.find({
        eventId: event._id,
        status: { $in: ['pending', 'approved'] },
      }).select('volunteerId');

      await Promise.all(
        affected.slice(0, 200).map((application) =>
          notify({
            recipient: application.volunteerId,
            type: 'event_updated',
            title: 'Opportunity details updated',
            message: `"${event.title}" has new date, time or location details. Please check the event page.`,
            link: `/events/${event._id}`,
            meta: { eventId: String(event._id) },
          })
        )
      );
    }

    const populated = await Event.findById(event._id).populate(populate);

    await audit.record(req, {
      action: 'event.update',
      entityType: 'Event',
      entityId: event._id,
      summary: `Updated "${event.title}"`,
      meta: { status: event.status, scheduleChanged },
    });

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
    if (ngo.status === 'suspended' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'This organisation is suspended and its activities are read-only.',
      });
    }

    await Event.deleteOne({ _id: event._id });

    await audit.record(req, {
      action: 'event.delete',
      entityType: 'Event',
      entityId: event._id,
      summary: `Deleted "${event.title}"`,
      meta: { ngoId: String(event.ngoId) },
    });

    return res.json({ success: true, message: 'Event removed.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getEvents, getEvent, getRecommended, getMyEvents, createEvent, updateEvent, deleteEvent };