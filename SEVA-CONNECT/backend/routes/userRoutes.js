/**
 * User routes.
 * GET /api/users/me          — authenticated profile
 * PATCH /api/users/me        — update own profile (name, phone, skills, interests, profileImage)
 */
const router = require('express').Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/me', protect, userController.getMe);

router.patch(
  '/me',
  protect,
  userController.UPDATABLE.map((field) =>
    body(field)
      .optional()
      .custom((value) => value !== undefined)
      .withMessage('Invalid value')
  ),
  [
    body('name').if(body('name').exists()).trim().notEmpty().isLength({ max: 80 }),
    body('phone').if(body('phone').exists()).trim().isLength({ max: 30 }),
    body('skills').if(body('skills').exists()).isArray().withMessage('Skills must be a list'),
    body('interests').if(body('interests').exists()).isArray().withMessage('Interests must be a list'),
    body('profileImage')
      .optional({ values: 'falsy' })
      .isURL()
      .withMessage('Profile image must be a valid URL'),
  ],
  validate,
  userController.updateMe
);

module.exports = router;