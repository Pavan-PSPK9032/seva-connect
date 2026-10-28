/**
 * Auth routes — public registration, login, logout and password recovery.
 *
 * Dedicated limiters protect brute-force surfaces in addition to the
 * per-account limits enforced inside the controllers.
 */
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const limiterMessage = (message) => ({ success: false, message });

// Route-level brute-force limits are intentionally high under NODE_ENV=test so
// the integration suite can exercise many flows in one process. Production
// always uses the values shown here.
const testMode = process.env.NODE_ENV === 'test';
const authMax = testMode ? 1000 : 20;
const passwordMax = testMode ? 1000 : 10;
const googleMax = testMode ? 1000 : 20;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage('Too many attempts. Please try again later.'),
});

const googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: googleMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage('Too many Google sign-in attempts. Please try again later.'),
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: passwordMax,
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
    .custom((value) => value === true)
    .withMessage('Please accept the terms and privacy policy to continue'),
];

const googleRules = [
  body('credential')
    .isString()
    .withMessage('Google credential is required')
    .isLength({ min: 20, max: 8192 })
    .withMessage('Google credential is invalid'),
  body('nonce')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ max: 128 })
    .withMessage('Google nonce is invalid'),
  body('acceptTerms').optional().isBoolean().withMessage('Terms acceptance must be true or false'),
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

router.post('/login', authLimiter, loginRules, validate, authController.login);
router.post('/google', googleLimiter, googleRules, validate, authController.googleSignIn);
router.post(
  '/google/link',
  protect,
  googleLimiter,
  googleRules,
  validate,
  authController.linkGoogle
);
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
