/**
 * Certificate controllers.
 * GET /api/certificates/mine   — the signed-in volunteer's certificates
 * GET /api/certificates/:code  — public verification by human-readable code
 */
const Certificate = require('../models/Certificate');

async function getMine(req, res, next) {
  try {
    const items = await Certificate.find({ volunteerId: req.user._id }).sort({ issuedAt: -1 });
    return res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

async function verify(req, res, next) {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const certificate = await Certificate.findOne({ certificateId: code });

    if (!certificate) {
      return res.status(404).json({ success: false, message: 'No certificate matches that code.' });
    }

    return res.json({ success: true, data: certificate });
  } catch (error) {
    next(error);
  }
}

module.exports = { getMine, verify };
