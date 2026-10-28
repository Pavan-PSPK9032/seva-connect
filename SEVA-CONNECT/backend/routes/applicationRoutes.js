/**
 * Application routes.
 * Volunteer: POST /, GET /mine, PATCH /:id/withdraw
 * NGO/admin: GET /event/:eventId, PATCH /:id/status
 */
const router = require('express').Router();
const { body, param } = require('express-validator');

const applicationController = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const idParam = [param('id').isMongoId().withMessage('Invalid application id')];

const applyRules = [
  body('eventId').isMongoId().withMessage('A valid event is required'),
  body('coverNote')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters'),
];

const decideRules = [
  body('status')
    .isIn(['approved', 'rejected', 'completed'])
    .withMessage('Status must be approved, rejected or completed'),
  body('note')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),
  body('hoursCredited')
    .optional({ values: 'falsy' })
    .isInt({ min: 0, max: 1000 })
    .withMessage('Hours must be between 0 and 1000')
    .toInt(),
];

router.post('/', protect, authorize('volunteer'), applyRules, validate, applicationController.apply);
router.get('/', protect, (req, res) => {
  return res.status(400).json({ success: false, message: 'Use /api/applications/mine for your applications.' });
});
router.get('/mine', protect, applicationController.getMine);
router.patch('/:id/withdraw', protect, idParam, validate, applicationController.withdraw);

router.get(
  '/received',
  protect,
  authorize('ngo', 'admin'),
  applicationController.getReceived
);

router.get(
  '/event/:eventId',
  protect,
  authorize('ngo', 'admin'),
  [param('eventId').isMongoId().withMessage('Invalid event id')],
  validate,
  applicationController.getForEvent
);

router.patch(
  '/:id/status',
  protect,
  authorize('ngo', 'admin'),
  idParam,
  decideRules,
  validate,
  applicationController.decide
);

module.exports = router;
