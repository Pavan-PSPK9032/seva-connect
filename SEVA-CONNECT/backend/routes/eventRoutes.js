/**
 * Event routes.
 * Public:  GET  /
 * Protected: GET /mine, POST /, PATCH /:id, DELETE /:id
 */
const router = require('express').Router();
const { body, param } = require('express-validator');
const eventController = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

const eventBody = ({ update = false } = {}) => {
  const rules = [
    body('title').trim().notEmpty().withMessage('Event title is required').isLength({ max: 120 }),
    body('description').notEmpty().withMessage('Event description is required').isLength({ max: 3000 }),
    body('date').matches(DATE_RE).withMessage('Event date is required (YYYY-MM-DD)').toDate(),
    body('time').trim().notEmpty().withMessage('Event time is required'),
    body('location').trim().notEmpty().withMessage('Event location is required'),
    body('online').optional().isBoolean().withMessage('online must be true/false'),
    body('causes').optional().isArray().withMessage('Causes must be a list'),
    body('requiredVolunteers').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
    body('status').optional().isIn(['upcoming', 'ongoing', 'completed', 'cancelled']).withMessage('Invalid status'),
  ];
  if (update) {
    return rules.map((r) => r.optional());
  }
  return [
    ...rules,
    body('ngoId').isMongoId().withMessage('A valid NGO id is required'),
  ];
};

const idParam = [param('id').isMongoId().withMessage('Invalid event id')];

router.get('/', eventController.getEvents);
router.get('/mine', protect, authorize('ngo', 'admin'), eventController.getMyEvents);
router.post('/', protect, authorize('ngo', 'admin'), eventBody(), validate, eventController.createEvent);
router.patch('/:id', protect, idParam, eventBody({ update: true }), validate, eventController.updateEvent);
router.delete('/:id', protect, idParam, validate, eventController.deleteEvent);

module.exports = router;