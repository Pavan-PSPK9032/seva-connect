/**
 * Notification routes — all scoped to the authenticated recipient.
 */
const router = require('express').Router();
const { body, param } = require('express-validator');

const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const preferencesRules = [
  body('inApp').optional().isBoolean().withMessage('inApp must be true or false'),
  body('email').optional().isBoolean().withMessage('email must be true or false'),
  body('reminders').optional().isBoolean().withMessage('reminders must be true or false'),
];

router.get('/', protect, notificationController.list);
router.get('/unread-count', protect, notificationController.unreadCount);
router.patch('/read-all', protect, notificationController.markAllRead);
router.get('/preferences', protect, notificationController.getPreferences);
router.patch('/preferences', protect, preferencesRules, validate, notificationController.updatePreferences);
router.patch(
  '/:id/read',
  protect,
  [param('id').isMongoId().withMessage('Invalid notification id')],
  validate,
  notificationController.markRead
);

module.exports = router;
