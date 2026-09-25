/**
 * Auth routes — public registration & login.
 * A dedicated, stricter rate limit protects against brute-force attempts.
 */
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const authController = require('../controllers/authController');
const validate = require('../middleware/validate');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

const registerRules = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('Name must be between 2 and 60 characters'),
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters'),
  body('role')
    .optional()
    .trim()
    .toLowerCase()
    .isIn(['volunteer', 'ngo'])
    .withMessage('Role must be "volunteer" or "ngo"'),
  body('phone')
    .optional({ values: 'falsy' })
    .matches(/^\+?[\d\s\-()]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
  body('skills').optional().isArray({ max: 20 }).withMessage('Skills must be an array'),
  body('interests').optional().isArray({ max: 20 }).withMessage('Interests must be an array'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', authLimiter, registerRules, validate, authController.register);
router.post('/login', authLimiter, loginRules, validate, authController.login);

module.exports = router;