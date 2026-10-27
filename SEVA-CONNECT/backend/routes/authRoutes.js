/**
 * Auth routes — public registration, email OTP verification, login, logout and
 * password recovery.
 *
 * Dedicated limiters protect brute-force and OTP-abuse surfaces in addition to
 * the per-challenge limits enforced inside services/otpService.js.
 */
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const limiterMessage = (message) => ({ success: false, message });

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage('Too many attempts. Please try again later.'),
});

// Verification attempts are cheap to submit but expensive to guess; allow a
// normal amount of typos while still cutting off automated guessing.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage('Too many verification attempts. Please try again later.'),
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage('Too many code requests. Please try again later.'),
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage('Too many password attempts. Please try again later.'),
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
  body('acceptTerms')
    .optional()
    .isBoolean()
    .withMessage('Terms acceptance must be true or false'),
];

const verifyRules = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('otp')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Enter the six-digit code from your email'),
];

const resendRules = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage('New password must be different from the current password'),
];

const forgotRules = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
];

const resetRules = [
  body('token').trim().isLength({ min: 20 }).withMessage('Invalid or missing reset token'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters'),
];

router.post('/register', authLimiter, registerRules, validate, authController.register);
router.post('/verify-email', verifyLimiter, verifyRules, validate, authController.verifyEmail);
router.post(
  '/resend-verification',
  resendLimiter,
  resendRules,
  validate,
  authController.resendVerification
);

router.post('/login', authLimiter, loginRules, validate, authController.login);
router.post('/logout', protect, authController.logout);
router.post('/logout-all', protect, authController.logout);

router.put(
  '/password',
  protect,
  passwordLimiter,
  changePasswordRules,
  validate,
  authController.changePassword
);

router.post('/forgot-password', passwordLimiter, forgotRules, validate, authController.forgotPassword);
router.post('/reset-password', passwordLimiter, resetRules, validate, authController.resetPassword);

module.exports = router;
