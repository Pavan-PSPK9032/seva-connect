/**
 * User profile controllers.
 * GET/PATCH /api/users/me — the authenticated user's own profile only.
 * Saved-opportunity endpoints are also scoped to the caller.
 */
const User = require('../models/User');
const Event = require('../models/Event');

async function getMe(req, res) {
  res.json({ success: true, user: req.user });
}

// PATCH /api/users/me
async function updateMe(req, res, next) {
  try {
    const { name, phone, skills, interests, profileImage, location, availability, preferredCauses, leaderboardOptOut } =
      req.body;

    const forbidden = Object.keys(req.body).filter((k) => !isUpdatable(k));
    if (forbidden.length) {
      return res.status(400).json({
        success: false,
        message: `Field(s) cannot be changed here: ${forbidden.join(', ')}`,
      });
    }

    if (name !== undefined) req.user.name = name;
    if (phone !== undefined) req.user.phone = phone;
    if (Array.isArray(skills)) {
      req.user.skills = skills.map((s) => String(s).trim()).filter(Boolean);
    }
    if (Array.isArray(interests)) {
      req.user.interests = interests.map((s) => String(s).trim()).filter(Boolean);
    }
    if (profileImage !== undefined) req.user.profileImage = profileImage;
    if (location !== undefined) req.user.location = String(location).trim();
    if (availability !== undefined) req.user.availability = String(availability).trim();
    if (Array.isArray(preferredCauses)) {
      req.user.preferredCauses = preferredCauses.map((s) => String(s).trim()).filter(Boolean);
    }
    if (leaderboardOptOut !== undefined) req.user.leaderboardOptOut = Boolean(leaderboardOptOut);

    await req.user.save();
    res.json({ success: true, message: 'Profile updated.', user: req.user });
  } catch (error) {
    next(error);
  }
}

// GET /api/users/me/saved-events
async function getSavedEvents(req, res, next) {
  try {
    const items = await Event.find({ _id: { $in: req.user.savedEvents || [] } })
      .populate({ path: 'ngoId', select: 'organizationName verified logo' })
      .sort({ date: 1 });

    const data = items.map((ev) => {
      const doc = ev.toObject();
      doc.ngoName = doc.ngoId ? doc.ngoId.organizationName : '';
      doc.ngoVerified = doc.ngoId ? doc.ngoId.verified : false;
      doc.ngoLogo = doc.ngoId ? doc.ngoId.logo : '';
      return doc;
    });

    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// POST /api/users/me/saved-events/:eventId
async function saveEvent(req, res, next) {
  try {
    const event = await Event.findById(req.params.eventId).select('_id');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Opportunity not found.' });
    }

    // $addToSet keeps the list idempotent across double-clicks.
    await User.updateOne({ _id: req.user._id }, { $addToSet: { savedEvents: event._id } });
    return res.json({ success: true, message: 'Opportunity saved.', data: { eventId: event._id } });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/users/me/saved-events/:eventId
async function unsaveEvent(req, res, next) {
  try {
    await User.updateOne({ _id: req.user._id }, { $pull: { savedEvents: req.params.eventId } });
    return res.json({ success: true, message: 'Opportunity removed from saved list.' });
  } catch (error) {
    next(error);
  }
}

// Identity fields users may manage themselves (used by route validation).
const UPDATABLE = [
  'name',
  'phone',
  'skills',
  'interests',
  'profileImage',
  'location',
  'availability',
  'preferredCauses',
  'leaderboardOptOut',
];
const isUpdatable = (field) => UPDATABLE.includes(field);

module.exports = {
  getMe,
  updateMe,
  getSavedEvents,
  saveEvent,
  unsaveEvent,
  isUpdatable,
  UPDATABLE,
};
