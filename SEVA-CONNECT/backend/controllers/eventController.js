/**
 * Event controllers.
 * Public:  GET /api/events       — listing (search/filter/pagination)
 * Protected: GET /api/events/mine — events for the caller's NGOs
 *            POST /api/events     — create for own NGO (ngo/admin)
 *            PATCH /api/events/:id — update (owner NGO/admin)
 *            DELETE /api/events/:id — delete (owner NGO/admin)
 *
 * New events start as `pending_approval` and require administrator approval.
 * Only approved events from approved, active organisations are public.
 */
const Event = require('../models/Event');
const NGO = require('../models/NGO');
const Application = require('../models/Application');
const { notify } = require('../services/notificationService');
const audit = require('../services/auditService');
const { ngoIsApproved, eventIsApproved, approvedEventClause } = require('../utils/approval');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function canManageNGO(user, ngo) {
  if (!user || !ngo) return false;
  if (user.role === 'admin') return true;
  return ngo.createdBy && ngo.createdBy.toString() === String(user._id);
}

const populate = { path: 'ngoId', select: 'organizationName verified approved approvalStatus logo location status contactEmail' };

function shapeEvent(ev) {
  const doc = ev.toObject();
  doc.ngoName = doc.ngoId ? doc.ngoId.organizationName : '';
  doc.ngoVerified = doc.ngoId ? doc.ngoId.verified : false;
  doc.ngoApproved = doc.ngoId ? ngoIsApproved(doc.ngoId) : false;
  doc.ngoLogo = doc.ngoId ? doc.ngoId.logo : '';
  return doc;
}

function pickEventFields(body) {
  const fields = {};
  const strings = ['title', 'description', 'time', 'location', 'image', 'category', 'contactEmail', 'contactPhone', 'instructions', 'eligibility'];
  strings.forEach((key) => {
    if (body[key] !== undefined) fields[key] = String(body[key]).trim();
  });
  if (body.date !== undefined && body.date) fields.date = body.date;
  if (body.online !== undefined) fields.online = body.online === true;
  if (Array.isArray(body.causes)) fields.causes = body.causes.map((c) => String(c).trim()).filter(Boolean);
  if (Array.isArray(body.requiredSkills)) {
    fields.requiredSkills = body.requiredSkills.map((s) => String(s).trim()).filter(Boolean);
  }
  if (body.applicationDeadline !== undefined) fields.applicationDeadline = body.applicationDeadline || null;
  if (body.requiredVolunteers !== undefined && body.requiredVolunteers !== '') {
    fields.requiredVolunteers = body.requiredVolunteers;
  }
  return fields;
}

// Only fields that materially change what a volunteer agreed to join.
const MATERIAL_FIELDS = [
  'title',
  'description',
  'date',
  'time',
  'location',
  'online',
  'causes',
  'requiredSkills',
  'eligibility',
  'applicationDeadline',
  'requiredVolunteers',
  'image',
  'category',
  'instructions',
];

async function getApprovedNGOIds() {
  const ngos = await NGO.find({
    status: { $ne: 'suspended' },
    $or: [
      { approvalStatus: 'approved' },
      { approvalStatus: { $exists: false }, $or: [{ approved: true }, { verified: true }] },
    ],
  }).select('_id');
  return ngos.map((ngo) => ngo._id);
}

async function getEvents(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 9));
    const skip = (page - 1) * limit;

    const approvedNgoIds = await getApprovedNGOIds();
    const filter = {
      $and: [
        approvedEventClause(),
        { ngoId: { $in: approvedNgoIds } },
        { status: req.query.status ? { $in: req.query.status.split(',') } : { $in: ['upcoming', 'ongoing'] } },
      ],
    };

    const q = (req.query.q || '').trim();
    if (q) {
      filter.$and.push({
        $or: [
          { title: { $regex: escapeRegex(q), $options: 'i' } },
          { description: { $regex: escapeRegex(q), $options: 'i' } },
          { location: { $regex: escapeRegex(q), $options: 'i' } },
          { causes: { $regex: escapeRegex(q), $options: 'i' } },
          { requiredSkills: { $regex: escapeRegex(q), $options: 'i' } },
        ],
      });
    }
    if (req.query.cause) {
      filter.$and.push({ causes: { $regex: `^${escapeRegex(req.query.cause)}$`, $options: 'i' } });
    }
    if (req.query.skill) {
      filter.$and.push({ requiredSkills: { $regex: escapeRegex(String(req.query.skill).trim()), $options: 'i' } });
    }
    if (req.query.online === 'true') filter.$and.push({ online: true });
    if (req.query.online === 'false') filter.$and.push({ online: false });
    if (req.query.ngoId) filter.$and.push({ ngoId: req.query.ngoId });
    if (req.query.hasSeats === 'true') {
      filter.$and.push({ $expr: { $lt: ['$registeredVolunteers', '$requiredVolunteers'] } });
    }

    const order = req.query.order === 'desc' ? -1 : 1;
    let sort = { date: order };
    if (req.query.sort === 'newest') sort = { createdAt: -1 };
    if (req.query.sort === 'deadline') sort = { applicationDeadline: 1, date: 1 };
    if (req.query.sort === 'popular') sort = { registeredVolunteers: -1, date: 1 };

    const [items, total] = await Promise.all([
      Event.find(filter).populate(populate).sort(sort).skip(skip).limit(limit),
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
      select: 'organizationName description verified approved approvalStatus logo location website contactEmail contactPhone causes status',
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const ownerOrAdmin = canManageNGO(req.user, event.ngoId);
    if (!eventIsApproved(event) && !ownerOrAdmin) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const doc = shapeEvent(event);
    if (event.ngoId) {
      doc.ngo = {
        _id: event.ngoId._id,
        organizationName: event.ngoId.organizationName,
        description: event.ngoId.description,
        verified: event.ngoId.verified,
        approved: ngoIsApproved(event.ngoId),
        logo: event.ngoId.logo,
        location: event.ngoId.location,
        website: event.ngoId.website,
        contactEmail: event.ngoId.contactEmail,
        contactPhone: event.ngoId.contactPhone,
        causes: event.ngoId.causes,
      };
    }

    const approvedNgoIds = await getApprovedNGOIds();
    const relatedFilter = {
      _id: { $ne: event._id },
      status: { $in: ['upcoming', 'ongoing'] },
      $and: [approvedEventClause(), { ngoId: { $in: approvedNgoIds } }],
    };
    if (event.causes && event.causes.length) relatedFilter.causes = { $in: event.causes };

    const related = await Event.find(relatedFilter).populate(populate).sort({ date: 1 }).limit(3);
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

    const approvedNgoIds = await getApprovedNGOIds();
    const [events, applied] = await Promise.all([
      Event.find({
        status: { $in: ['upcoming', 'ongoing'] },
        $and: [approvedEventClause(), { ngoId: { $in: approvedNgoIds } }],
      })
        .populate(populate)
        .limit(120),
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
    const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };
    const ngos = await NGO.find(filter).select('_id');
    const ids = ngos.map((n) => n._id);
    const items = await Event.find({ ngoId: { $in: ids } }).populate(populate).sort({ date: 1 });
    res.json({ success: true, data: items.map(shapeEvent) });
  } catch (error) {
    next(error);
  }
}

// POST /api/events
async function createEvent(req, res, next) {
  try {
    const ngo = await NGO.findById(req.body.ngoId);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }
    if (!canManageNGO(req.user, ngo)) {
      return res.status(403).json({
        success: false,
        message: 'You can only create events for NGOs you manage.',
      });
    }
    if (ngo.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'This organisation is suspended and cannot create new activities.',
      });
    }
    if (!ngoIsApproved(ngo) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'This organisation must be approved by an administrator before creating events.',
      });
    }

    const isAdmin = req.user.role === 'admin';
    const event = await Event.create({
      ...pickEventFields(req.body),
      ngoId: ngo._id,
      registeredVolunteers: 0,
      rejectionReason: '',
      submittedAt: new Date(),
      approved: isAdmin,
      approvalStatus: isAdmin ? 'approved' : 'pending',
      approvedAt: isAdmin ? new Date() : null,
      approvedBy: isAdmin ? req.user._id : null,
      status: isAdmin ? 'upcoming' : 'pending_approval',
    });

    const populated = await Event.findById(event._id).populate(populate);

    await audit.record(req, {
      action: 'event.create',
      entityType: 'Event',
      entityId: event._id,
      summary: `Created "${event.title}" (${event.approvalStatus})`,
      meta: { ngoId: String(event.ngoId), status: event.status },
    });

    return res.status(201).json({
      success: true,
      message: isAdmin
        ? 'Event created and published.'
        : 'Event submitted. It is pending administrator approval and is not public yet.',
      data: shapeEvent(populated),
    });
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
    if (ngo.status === 'suspended' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'This organisation is suspended and its activities are read-only.',
      });
    }

    const previous = {
      status: event.status,
      date: event.date ? new Date(event.date).toISOString() : null,
      time: event.time,
      location: event.location,
    };

    const fields = pickEventFields(req.body);
    const changedKeys = Object.keys(fields).filter((key) => {
      if (key === 'date') {
        return new Date(fields.date).toISOString() !== previous.date;
      }
      return JSON.stringify(fields[key]) !== JSON.stringify(event[key]);
    });
    Object.entries(fields).forEach(([key, value]) => {
      event[key] = value;
    });

    // Moving an event to a different NGO is only allowed between organisations
    // the caller manages.
    if (req.body.ngoId && String(req.body.ngoId) !== String(event.ngoId)) {
      const target = await NGO.findById(req.body.ngoId);
      if (!target) {
        return res.status(404).json({ success: false, message: 'Target NGO not found.' });
      }
      if (!canManageNGO(req.user, target)) {
        return res.status(403).json({
          success: false,
          message: 'You can only move events between NGOs you manage.',
        });
      }
      event.ngoId = target._id;
    }

    // Owners may cancel or complete their own event, but cannot publish it
    // themselves. Publishing is an administrator action.
    const requestedStatus = req.body.status;
    if (requestedStatus !== undefined && req.user.role === 'admin') {
      event.status = requestedStatus;
    } else if (requestedStatus === 'cancelled' || requestedStatus === 'completed' || requestedStatus === 'ongoing') {
      event.status = requestedStatus;
    }

    const materiallyChanged = changedKeys.some((key) => MATERIAL_FIELDS.includes(key));
    const needsReview =
      req.user.role !== 'admin' &&
      materiallyChanged &&
      event.approvalStatus === 'approved' &&
      event.status !== 'cancelled' &&
      event.status !== 'completed';
    if (needsReview) {
      event.approvalStatus = 'pending';
      event.approved = false;
      event.approvedAt = null;
      event.approvedBy = null;
      event.status = 'pending_approval';
      event.rejectionReason = '';
      event.submittedAt = new Date();
    }

    await event.save();

    const current = {
      date: event.date ? new Date(event.date).toISOString() : null,
      time: event.time,
      location: event.location,
    };
    const scheduleChanged =
      current.date !== previous.date || current.time !== previous.time || current.location !== previous.location;

    if (previous.status !== 'cancelled' && event.status === 'cancelled') {
      // Cancelling releases approved seats and closes open applications.
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
    } else if (scheduleChanged && event.approvalStatus === 'approved') {
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
      action: needsReview ? 'event.resubmit' : 'event.update',
      entityType: 'Event',
      entityId: event._id,
      summary: needsReview
        ? `Edited "${event.title}" and sent it for re-approval`
        : `Updated "${event.title}"`,
      meta: { status: event.status, approvalStatus: event.approvalStatus, scheduleChanged },
    });

    return res.json({
      success: true,
      message: needsReview
        ? 'Event updated. Because participation details changed, it is pending administrator approval again.'
        : 'Event updated.',
      data: shapeEvent(populated),
    });
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
