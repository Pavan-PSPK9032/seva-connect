/**
 * NGO controllers.
 * Public:  GET /api/ngos        — directory listing (search/filter/pagination)
 * Protected: GET /api/ngos/mine — NGOs created by the caller
 *            POST /api/ngos     — create (ngo/admin)
 *            PATCH /api/ngos/:id — update/resubmit (owner/admin)
 *            DELETE /api/ngos/:id — delete (owner/admin; cascades events)
 *
 * New submissions always start `pending` and are only listed publicly after an
 * administrator approves them.
 */
const NGO = require('../models/NGO');
const Event = require('../models/Event');
const Application = require('../models/Application');
const { ngoIsApproved, approvedNGOClause } = require('../utils/approval');
const { notify } = require('../services/notificationService');
const audit = require('../services/auditService');

const SORTABLE = { name: 'organizationName', location: 'location', createdAt: 'createdAt' };

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function canManageNGO(user, ngo) {
  if (!user || !ngo) return false;
  if (user.role === 'admin') return true;
  return ngo.createdBy && ngo.createdBy.toString() === String(user._id);
}

function normalizeDocuments(input) {
  if (!Array.isArray(input)) return undefined;
  return input
    .map((doc) => {
      if (typeof doc === 'string') return { name: '', url: doc.trim() };
      return {
        name: String(doc?.name || '').trim().slice(0, 120),
        url: String(doc?.url || '').trim().slice(0, 500),
      };
    })
    .filter((doc) => doc.url)
    .slice(0, 10);
}

async function getNGOs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 9));
    const skip = (page - 1) * limit;

    // Only approved, non-suspended organisations are public. The legacy clause
    // keeps pre-approval records visible until the migration is run.
    const filter = { $and: [{ status: { $ne: 'suspended' } }, approvedNGOClause()] };

    const q = (req.query.q || '').trim();
    if (q) {
      filter.$and.push({
        $or: [
          { organizationName: { $regex: escapeRegex(q), $options: 'i' } },
          { location: { $regex: escapeRegex(q), $options: 'i' } },
          { causes: { $regex: escapeRegex(q), $options: 'i' } },
        ],
      });
    }
    if (req.query.cause) {
      filter.$and.push({ causes: { $regex: `^${escapeRegex(req.query.cause)}$`, $options: 'i' } });
    }

    const sortField = SORTABLE[req.query.sort] || 'createdAt';
    const sort = { [sortField]: req.query.order === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      NGO.find(filter).sort(sort).skip(skip).limit(limit),
      NGO.countDocuments(filter),
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

// GET /api/ngos/mine — includes pending and rejected submissions for the owner.
async function getMyNGOs(req, res, next) {
  try {
    const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };
    const items = await NGO.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

// POST /api/ngos
async function createNGO(req, res, next) {
  try {
    const {
      organizationName,
      description,
      location,
      contactEmail,
      contactPhone,
      address,
      causes,
      website,
      logo,
      registrationNumber,
      registrationDetails,
    } = req.body;

    const ngo = await NGO.create({
      organizationName,
      description,
      location,
      contactEmail,
      contactPhone: contactPhone || '',
      address: address || '',
      causes: Array.isArray(causes) ? causes.map((c) => String(c).trim()).filter(Boolean) : [],
      website: website || '',
      logo: logo || '',
      registrationNumber: registrationNumber || '',
      registrationDetails: registrationDetails || '',
      documents: normalizeDocuments(req.body.documents) || [],
      createdBy: req.user._id,
      verificationRequested: false,
      approved: false,
      verified: false,
      approvalStatus: 'pending',
      submittedAt: new Date(),
    });

    await audit.record(req, {
      action: 'ngo.submit',
      entityType: 'NGO',
      entityId: ngo._id,
      summary: `Submitted organisation "${ngo.organizationName}" for approval`,
    });

    return res.status(201).json({
      success: true,
      message:
        'Submission received. Your organisation is pending administrator approval and is not public yet.',
      data: ngo,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/ngos/:id
async function updateNGO(req, res, next) {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }
    if (!canManageNGO(req.user, ngo)) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage NGOs you created.',
      });
    }

    if (ngo.status === 'suspended' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'This organisation is suspended and its records are read-only.',
      });
    }

    if (
      (req.body.verified !== undefined || req.body.approved !== undefined || req.body.approvalStatus !== undefined) &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can change approval status.',
      });
    }

    const {
      organizationName,
      description,
      location,
      contactEmail,
      contactPhone,
      address,
      causes,
      website,
      logo,
      registrationNumber,
      registrationDetails,
    } = req.body;

    if (organizationName !== undefined) ngo.organizationName = organizationName;
    if (description !== undefined) ngo.description = description;
    if (location !== undefined) ngo.location = location;
    if (contactEmail !== undefined) ngo.contactEmail = contactEmail;
    if (contactPhone !== undefined) ngo.contactPhone = contactPhone;
    if (address !== undefined) ngo.address = address;
    if (Array.isArray(causes)) ngo.causes = causes.map((c) => String(c).trim()).filter(Boolean);
    if (website !== undefined) ngo.website = website;
    if (logo !== undefined) ngo.logo = logo;
    if (registrationNumber !== undefined) ngo.registrationNumber = registrationNumber;
    if (registrationDetails !== undefined) ngo.registrationDetails = registrationDetails;
    const documents = normalizeDocuments(req.body.documents);
    if (documents !== undefined) ngo.documents = documents;

    if (req.user.role === 'admin') {
      if (req.body.verified !== undefined) ngo.verified = req.body.verified === true;
      if (req.body.approved !== undefined) ngo.approved = req.body.approved === true;
    }

    // Editing a rejected or returned submission resubmits it for review.
    const resubmitted = ['rejected', 'changes_requested'].includes(ngo.approvalStatus);
    if (resubmitted) {
      ngo.approvalStatus = 'pending';
      ngo.rejectionReason = '';
      ngo.submittedAt = new Date();
      ngo.reviewedAt = null;
      ngo.reviewedBy = null;
    }

    await ngo.save();

    if (resubmitted) {
      await audit.record(req, {
        action: 'ngo.resubmit',
        entityType: 'NGO',
        entityId: ngo._id,
        summary: `Resubmitted organisation "${ngo.organizationName}" for approval`,
      });
    }

    return res.json({
      success: true,
      message: resubmitted
        ? 'Changes saved. Your organisation is pending administrator approval again.'
        : 'NGO updated.',
      data: ngo,
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/ngos/:id
async function deleteNGO(req, res, next) {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }
    if (!canManageNGO(req.user, ngo)) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage NGOs you created.',
      });
    }

    await NGO.deleteOne({ _id: ngo._id });
    await Event.deleteMany({ ngoId: ngo._id });
    return res.json({ success: true, message: 'NGO and its events were removed.' });
  } catch (error) {
    next(error);
  }
}

// GET /api/ngos/:id
async function getNGO(req, res, next) {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }

    const isOwnerOrAdmin = canManageNGO(req.user, ngo);
    if (ngo.status === 'suspended' && !isOwnerOrAdmin) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }
    if (!ngoIsApproved(ngo) && !isOwnerOrAdmin) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }

    const [events, completedEvents, totalHours, volunteers] = await Promise.all([
      Event.find({
        ngoId: ngo._id,
        status: { $in: ['upcoming', 'ongoing'] },
        ...(ngoIsApproved(ngo) ? { approvalStatus: 'approved' } : {}),
      })
        .sort({ date: 1 })
        .limit(6),
      Event.countDocuments({ ngoId: ngo._id, status: 'completed' }),
      Application.aggregate([
        { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
        { $unwind: '$event' },
        { $match: { 'event.ngoId': ngo._id, status: 'completed' } },
        { $group: { _id: null, hours: { $sum: '$hoursCredited' } } },
      ]),
      Application.aggregate([
        { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
        { $unwind: '$event' },
        { $match: { 'event.ngoId': ngo._id, status: 'completed' } },
        { $group: { _id: '$volunteerId' } },
        { $count: 'total' },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        ...ngo.toObject(),
        events,
        stats: {
          completedEvents,
          verifiedHours: totalHours[0]?.hours || 0,
          activeVolunteers: volunteers[0]?.total || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/ngos/:id/request-verification — kept for older clients; now simply
// marks an unapproved submission as pending review again.
async function requestVerification(req, res, next) {
  try {
    const ngo = await NGO.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ success: false, message: 'NGO not found.' });
    }
    if (!canManageNGO(req.user, ngo)) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage NGOs you created.',
      });
    }
    if (ngoIsApproved(ngo)) {
      return res.status(400).json({ success: false, message: 'This organisation is already approved.' });
    }

    ngo.verificationRequested = true;
    ngo.submittedAt = new Date();
    if (['rejected', 'changes_requested'].includes(ngo.approvalStatus)) {
      ngo.approvalStatus = 'pending';
      ngo.rejectionReason = '';
    }
    if (req.body.note !== undefined) ngo.verificationNote = String(req.body.note).trim();
    await ngo.save();

    return res.json({
      success: true,
      message: 'Submission sent for review. An administrator will review this organisation.',
      data: { _id: ngo._id, approvalStatus: ngo.approvalStatus, verificationRequested: ngo.verificationRequested },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getNGOs, getNGO, getMyNGOs, createNGO, updateNGO, requestVerification, deleteNGO };
