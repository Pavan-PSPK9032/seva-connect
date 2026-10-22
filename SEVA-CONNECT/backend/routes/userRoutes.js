/**
 * User routes.
 * GET   /api/users/me                  — authenticated profile
 * PATCH /api/users/me                  — update own profile
 * GET   /api/users/me/saved-events     — bookmarked opportunities
 * POST  /api/users/me/saved-events/:eventId
 * DELETE /api/users/me/saved-events/:eventId
 */
const router = require('express').Router();
const { body, param } = require('express-validator');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/me', protect, userController.getMe);

router.patch(
  '/me',
  protect,
  [
    body('name').optional().trim().notEmpty().isLength({ max: 80 }),
    body('phone').optional().trim().isLength({ max: 30 }),
    body('skills').optional().isArray({ max: 30 }).withMessage('Skills must be a list'),
    body('interests').optional().isArray({ max: 30 }).withMessage('Interests must be a list'),
    body('preferredCauses').optional().isArray({ max: 30 }).withMessage('Preferred causes must be a list'),
    body('profileImage').optional({ values: 'falsy' }).isURL().withMessage('Profile image must be a valid URL'),
    body('location').optional().trim().isLength({ max: 100 }).withMessage('Location is too long'),
    body('availability').optional().trim().isLength({ max: 120 }).withMessage('Availability is too long'),
    body('leaderboardOptOut').optional().isBoolean().withMessage('leaderboardOptOut must be true or false'),
  ],
  validate,
  userController.updateMe
);

router.get('/me/saved-events', protect, userController.getSavedEvents);

router.post(
  '/me/saved-events/:eventId',
  protect,
  [param('eventId').isMongoId().withMessage('Invalid opportunity id')],
  validate,
  userController.saveEvent
);

router.delete(
  '/me/saved-events/:eventId',
  protect,
  [param('eventId').isMongoId().withMessage('Invalid opportunity id')],
  validate,
  userController.unsaveEvent
);

module.exports = router;
