/**
 * Authentication controllers — register & login.
 * Passwords are hashed by the User model before save; tokens are signed JWTs.
 */
const User = require('../models/User');
const signToken = require('../utils/generateToken');

// POST /api/auth/register
// Inputs are pre-validated by express-validator in the route (email format,
// password length, role whitelist volunteer/ngo only — admin is never public).
async function register(req, res, next) {
  try {
    const { name, email, password, phone, skills, interests, profileImage } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please log in.',
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: req.body.role || 'volunteer',
      phone: phone || '',
      skills: Array.isArray(skills) ? skills.map((s) => String(s).trim()).filter(Boolean) : [],
      interests: Array.isArray(interests) ? interests.map((s) => String(s).trim()).filter(Boolean) : [],
      profileImage: profileImage || '',
    });

    const token = signToken({ id: user._id });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    // Single generic message so we never reveal whether an email exists.
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = signToken({ id: user._id });

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login };