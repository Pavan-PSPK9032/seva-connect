/**
 * NGO controllers.
 * Phase 1 exposes public read endpoints only; NGO CRUD and admin review
 * are added in later phases.
 */
const NGO = require('../models/NGO');

const SORTABLE = { name: 'organizationName', location: 'location', createdAt: 'createdAt' };

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

module.exports = { getNGOs };