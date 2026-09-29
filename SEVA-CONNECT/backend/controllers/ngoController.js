/**
 * NGO controllers.
 * Public:  GET /api/ngos        — directory listing (search/filter/pagination)
 * Protected: GET /api/ngos/mine — NGOs created by the caller
 *            POST /api/ngos     — create (ngo/admin)
 *            PATCH /api/ngos/:id — update (owner/admin)
 *            DELETE /api/ngos/:id — delete (owner/admin; cascades events)
 */
const NGO = require('../models/NGO');
const Event = require('../models/Event');

const SORTABLE = { name: 'organizationName', location: 'location', createdAt: 'createdAt' };

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function canManageNGO(user, ngo) {
  if (user.role === 'admin') return true;
  return ngo.createdBy && ngo.createdBy.toString() === String(user._id);
}

async function getNGOs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 9));
    const skip = (page - 1) * limit;

    const filter = {};
    const q = (req.query.q || '').trim();
    if (q) {
      filter.$or = [
        { organizationName: { $regex: escapeRegex(q), $options: 'i' } },
        { location: { $regex: escapeRegex(q), $options: 'i' } },
        { causes: { $regex: escapeRegex(q), $options: 'i' } },
      ];
    }
    if (req.query.verified === 'true') filter.verified = true;
    if (req.query.verified === 'false') filter.verified = false;
    if (req.query.cause) {
      filter.causes = { $regex: `^${escapeRegex(req.query.cause)}$`, $options: 'i' };
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

// GET /api/ngos/mine
async function getMyNGOs(req, res, next) {
  try {
    const items = await NGO.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

// POST /api/ngos
async function createNGO(req, res, next) {
  try {
    const { organizationName, description, location, contactEmail, causes, website, logo } = req.body;

    const ngo = await NGO.create({
      organizationName,
      description,
      location,
      contactEmail,
      causes: Array.isArray(causes) ? causes.map((c) => String(c).trim()).filter(Boolean) : [],
      website: website || '',
      logo: logo || '',
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'NGO created. It is pending verification review.',
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

    if (req.body.verified !== undefined && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can change verification status.',
      });
    }

    const { organizationName, description, location, contactEmail, causes, website, logo, verified } = req.body;
    if (organizationName !== undefined) ngo.organizationName = organizationName;
    if (description !== undefined) ngo.description = description;
    if (location !== undefined) ngo.location = location;
    if (contactEmail !== undefined) ngo.contactEmail = contactEmail;
    if (Array.isArray(causes)) ngo.causes = causes.map((c) => String(c).trim()).filter(Boolean);
    if (website !== undefined) ngo.website = website;
    if (logo !== undefined) ngo.logo = logo;
    if (verified !== undefined && req.user.role === 'admin') ngo.verified = verified;

    await ngo.save();
    return res.json({ success: true, message: 'NGO updated.', data: ngo });
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

module.exports = { getNGOs, getMyNGOs, createNGO, updateNGO, deleteNGO };