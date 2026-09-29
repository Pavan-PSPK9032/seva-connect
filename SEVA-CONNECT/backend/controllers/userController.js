/**
 * User profile controllers.
 * GET/PATCH /api/users/me — the authenticated user's own profile only.
 */
const User = require('../models/User');

async function getMe(req, res) {
  res.json({ success: true, user: req.user });
}

// PATCH /api/users/me
async function updateMe(req, res, next) {
  try {
    const { name, phone, skills, interests, profileImage } = req.body;

    const forbidden = Object.keys(req.body).filter(
      (k) => !isUpdatable(k)
    );
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

    await req.user.save();
    res.json({ success: true, message: 'Profile updated.', user: req.user });
  } catch (error) {
    next(error);
  }
}

// Identity fields users may manage themselves (used by route validation).
const UPDATABLE = ['name', 'phone', 'skills', 'interests', 'profileImage'];
const isUpdatable = (field) => UPDATABLE.includes(field);

module.exports = { getMe, updateMe, isUpdatable, UPDATABLE };