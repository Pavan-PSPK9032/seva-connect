/**
 * Event controllers.
 * Phase 1 exposes public read endpoints; event CRUD, registration and
 * attendance arrive in later phases.
 */
const Event = require('../models/Event');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
        .populate('ngoId', 'organizationName verified logo')
        .sort({ date: order })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    const data = items.map((ev) => {
      const doc = ev.toObject();
      doc.ngoName = doc.ngoId ? doc.ngoId.organizationName : '';
      doc.ngoVerified = doc.ngoId ? doc.ngoId.verified : false;
      doc.ngoLogo = doc.ngoId ? doc.ngoId.logo : '';
      return doc;
    });

    return res.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getEvents };