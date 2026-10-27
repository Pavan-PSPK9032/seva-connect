/**
 * Application controllers — the volunteer ⇄ opportunity lifecycle.
 *
 * Volunteer: POST /api/applications, GET /api/applications/mine,
 *            PATCH /api/applications/:id/withdraw
 * NGO/admin: GET /api/applications/event/:eventId,
 *            PATCH /api/applications/:id/status
 *
 * Capacity is enforced with a conditional atomic update on Event so two
 * concurrent approvals can never oversubscribe an event.
 */
const Application = require('../models/Application');
const Event = require('../models/Event');
const NGO = require('../models/NGO');
const { canManageNGO } = require('../utils/permissions');
const { notify } = require('../services/notificationService');
const { issueForApplication } = require('../services/certificateService');
const audit = require('../services/auditService');

const volunteerPopulate = {
  path: 'volunteerId',
  select: 'name email phone skills interests profileImage',
};
const eventPopulate = {
  path: 'eventId',
  select: 'title date time location online status requiredVolunteers registeredVolunteers ngoId',
  populate: { path: 'ngoId', select: 'organizationName verified logo' },
};

const DECIDABLE = ['approved', 'rejected', 'completed'];

function shape(application) {
  const doc = application.toObject ? application.toObject() : application;

  if (doc.volunteerId && typeof doc.volunteerId === 'object') {
    doc.volunteer = doc.volunteerId;
    doc.volunteerId = doc.volunteer._id;
  }

  if (doc.eventId && typeof doc.eventId === 'object' && doc.eventId.title) {
    const ev = doc.eventId;
    doc.event = {
      ...ev,
      ngoName: ev.ngoId && typeof ev.ngoId === 'object' ? ev.ngoId.organizationName : '',
      ngoVerified: ev.ngoId && typeof ev.ngoId === 'object' ? ev.ngoId.verified : false,
    };
    doc.eventId = ev._id;
  }

  return doc;
}

// Returns the NGO document and event if the caller may manage this event.
async function loadManagedEvent(req, eventId) {
  const event = await Event.findById(eventId);
  if (!event) return { error: { status: 404, message: 'Event not found.' } };

  const ngo = await NGO.findById(event.ngoId);
  if (!ngo) return { error: { status: 404, message: 'The owning NGO no longer exists.' } };

  if (!canManageNGO(req.user, ngo)) {
    return { error: { status: 403, message: 'You can only manage applications for your own events.' } };
  }
  return { event, ngo };
}

// POST /api/applications
async function apply(req, res, next) {
  try {
    const { eventId, coverNote } = req.body;

    const event = await Event.findById(eventId).populate({ path: 'ngoId', select: 'organizationName createdBy' });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    if (event.status !== 'upcoming' && event.status !== 'ongoing') {
      return res.status(400).json({ success: false, message: 'This opportunity is no longer accepting applications.' });
    }
    if (!event.approved) {
      return res.status(400).json({ success: false, message: 'This opportunity is pending admin approval.' });
    }
    const ngo = await NGO.findById(event.ngoId);
    if (ngo && !ngo.approved) {
      return res.status(400).json({ success: false, message: 'This NGO is pending admin approval.' });
    }
    if (event.applicationDeadline && new Date(event.applicationDeadline).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'The application deadline for this opportunity has passed.' });
    }
    if (event.registeredVolunteers >= event.requiredVolunteers) {
      return res.status(409).json({ success: false, message: 'This opportunity is already full.' });
    }

    const existing = await Application.findOne({ eventId: event._id, volunteerId: req.user._id });

    if (existing && existing.status !== 'withdrawn' && existing.status !== 'rejected') {
      return res.status(409).json({
        success: false,
        message: `You already have a ${existing.status} application for this opportunity.`,
      });
    }

    let application;
    if (existing) {
      // Re-open the withdrawn/rejected record instead of creating a duplicate.
      existing.status = 'pending';
      existing.coverNote = coverNote || '';
      existing.decidedBy = null;
      existing.decidedAt = null;
      existing.withdrawnAt = null;
      existing.hoursCredited = 0;
      application = await existing.save();
    } else {
      application = await Application.create({
        eventId: event._id,
        volunteerId: req.user._id,
        ngoId: event.ngoId._id,
        coverNote: coverNote || '',
        status: 'pending',
      });
    }

    if (event.ngoId.createdBy) {
      await notify({
        recipient: event.ngoId.createdBy,
        type: 'application_received',
        title: 'New application received',
        message: `${req.user.name} applied to "${event.title}".`,
        link: '/my-ngo',
        meta: { eventId: String(event._id), applicationId: String(application._id) },
      });
    }

    const populated = await Application.findById(application._id).populate(volunteerPopulate).populate(eventPopulate);
    return res.status(201).json({
      success: true,
      message: 'Application submitted. You will be notified when the NGO responds.',
      data: shape(populated),
    });
  } catch (error) {
    // Unique index race: another request created the application first.
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already applied to this opportunity.' });
    }
    next(error);
  }
}

// GET /api/applications/mine
async function getMine(req, res, next) {
  try {
    const status = (req.query.status || '').trim();
    const filter = { volunteerId: req.user._id };
    if (status) {
      const wanted = status.split(',').filter((s) => Application.STATUSES.includes(s));
      if (wanted.length) filter.status = { $in: wanted };
    }

    const [items, hours] = await Promise.all([
      Application.find(filter).populate(eventPopulate).sort({ createdAt: -1 }),
      Application.aggregate([
        { $match: { volunteerId: req.user._id, status: 'completed' } },
        { $group: { _id: null, hours: { $sum: '$hoursCredited' } } },
      ]),
    ]);

    const summary = {
      total: items.length,
      pending: items.filter((a) => a.status === 'pending').length,
      approved: items.filter((a) => a.status === 'approved').length,
      completed: items.filter((a) => a.status === 'completed').length,
      rejected: items.filter((a) => a.status === 'rejected').length,
      withdrawn: items.filter((a) => a.status === 'withdrawn').length,
      cancelled: items.filter((a) => a.status === 'cancelled').length,
      hours: hours[0]?.hours || 0,
    };

    return res.json({ success: true, data: items.map(shape), summary });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/applications/:id/withdraw
async function withdraw(req, res, next) {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    if (application.volunteerId.toString() !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only withdraw your own application.' });
    }
    if (!['pending', 'approved'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `A ${application.status} application cannot be withdrawn.`,
      });
    }

    const wasApproved = application.status === 'approved';
    const claimed = await Application.findOneAndUpdate(
      { _id: application._id, status: application.status },
      { $set: { status: 'withdrawn', withdrawnAt: new Date() } },
      { new: true }
    );
    if (!claimed) {
      return res.status(409).json({ success: false, message: 'This application changed state. Please refresh.' });
    }

    if (wasApproved) {
      // Release the seat, clamped at zero so historic seed counts cannot go negative.
      await Event.updateOne(
        { _id: application.eventId },
        [{ $set: { registeredVolunteers: { $max: [0, { $subtract: ['$registeredVolunteers', 1] }] } } }]
      );
    }

    const event = await Event.findById(application.eventId).populate({ path: 'ngoId', select: 'organizationName createdBy' });
    if (event?.ngoId?.createdBy) {
      await notify({
        recipient: event.ngoId.createdBy,
        type: 'application_withdrawn',
        title: 'Application withdrawn',
        message: `${req.user.name} withdrew from "${event.title}".`,
        link: '/my-ngo',
        meta: { eventId: String(event._id), applicationId: String(application._id) },
      });
    }

    return res.json({ success: true, message: 'Application withdrawn.', data: shape(claimed) });
  } catch (error) {
    next(error);
  }
}

// GET /api/applications/event/:eventId
async function getForEvent(req, res, next) {
  try {
    const { event, error } = await loadManagedEvent(req, req.params.eventId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const items = await Application.find({ eventId: event._id })
      .populate(volunteerPopulate)
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: items.map(shape),
      event: {
        _id: event._id,
        title: event.title,
        requiredVolunteers: event.requiredVolunteers,
        registeredVolunteers: event.registeredVolunteers,
      },
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/applications/:id/status
async function decide(req, res, next) {
  try {
    const { status, hoursCredited } = req.body;
    if (!DECIDABLE.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved, rejected or completed.' });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const { event, error } = await loadManagedEvent(req, application.eventId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const allowedFrom = status === 'completed' ? ['approved'] : ['pending'];
    if (!allowedFrom.includes(application.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot mark a ${application.status} application as ${status}.`,
      });
    }

    const decidedAt = new Date();
    const claimed = await Application.findOneAndUpdate(
      { _id: application._id, status: application.status },
      {
        $set: {
          status,
          decidedBy: req.user._id,
          decidedAt,
          ...(status === 'completed'
            ? { completedAt: decidedAt, hoursCredited: Math.min(1000, Math.max(0, Number(hoursCredited) || 0)) }
            : {}),
        },
      },
      { new: true }
    );
    if (!claimed) {
      return res.status(409).json({ success: false, message: 'This application was already decided. Please refresh.' });
    }

    if (status === 'approved') {
      // Atomic capacity guard: only succeeds while a seat is genuinely free.
      const seated = await Event.findOneAndUpdate(
        { _id: event._id, $expr: { $lt: ['$registeredVolunteers', '$requiredVolunteers'] } },
        { $inc: { registeredVolunteers: 1 } },
        { new: true }
      );

      if (!seated) {
        // Roll the status claim back so the application stays actionable.
        await Application.updateOne(
          { _id: claimed._id },
          { $set: { status: application.status, decidedBy: null, decidedAt: null } }
        );
        return res.status(409).json({
          success: false,
          message: 'This opportunity is now full. Increase capacity or reject the application instead.',
        });
      }
    }

    if (status === 'completed') {
      // Best-effort: a certificate failure must not undo a verified contribution.
      try {
        await issueForApplication(claimed);
      } catch (error) {
        console.error('[CERT] Could not issue certificate:', error.message);
      }
    }

    const messages = {
      approved: {
        type: 'application_approved',
        title: 'Application approved',
        message: `You are confirmed for "${event.title}". Check the event page for details.`,
      },
      rejected: {
        type: 'application_rejected',
        title: 'Application not accepted',
        message: `Your application for "${event.title}" was not accepted this time.`,
      },
      completed: {
        type: 'application_completed',
        title: 'Volunteering verified',
        message: `Your participation in "${event.title}" was completed with ${claimed.hoursCredited} verified hour(s).`,
      },
    };

    await notify({
      recipient: claimed.volunteerId,
      type: messages[status].type,
      title: messages[status].title,
      message: messages[status].message,
      link: status === 'completed' ? '/dashboard' : `/events/${event._id}`,
      meta: { eventId: String(event._id), applicationId: String(claimed._id) },
    });

    await audit.record(req, {
      action: `application.${status}`,
      entityType: 'Application',
      entityId: claimed._id,
      summary: `${status} application for "${event.title}"`,
      meta: { eventId: String(event._id), volunteerId: String(claimed.volunteerId) },
    });

    const populated = await Application.findById(claimed._id).populate(volunteerPopulate).populate(eventPopulate);
    return res.json({ success: true, message: `Application ${status}.`, data: shape(populated) });
  } catch (error) {
    next(error);
  }
}

module.exports = { apply, getMine, withdraw, getForEvent, decide };
