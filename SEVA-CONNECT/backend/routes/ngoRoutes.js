/**
 * NGO routes.
 * Public:  GET  /
 * Protected: GET /mine, POST /, PATCH /:id, DELETE /:id
 */
const router = require('express').Router();
const { body, param } = require('express-validator');
const ngoController = require('../controllers/ngoController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const ngoBody = ({ update = false } = {}) =>
  update
    ? [
        body('organizationName').optional().trim().notEmpty().isLength({ max: 100 }),
        body('description').optional().notEmpty().isLength({ max: 2000 }),
        body('location').optional().trim().notEmpty(),
        body('contactEmail').optional().trim().toLowerCase().matches(EMAIL_RE),
        body('causes').optional().isArray(),
        body('website').optional().trim(),
        body('logo').optional().trim(),
        body('contactPhone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
        body('address').optional({ values: 'falsy' }).trim().isLength({ max: 300 }),
        body('registrationNumber').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
        body('registrationDetails').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
        body('documents').optional().isArray({ max: 10 }).withMessage('Documents must be a list'),
        body('verified').optional().isBoolean(),
        body('approved').optional().isBoolean(),
        body('approvalStatus').optional().isIn(['pending', 'approved', 'rejected', 'changes_requested', 'suspended']),
      ]
    : [
        body('organizationName').trim().notEmpty().withMessage('Organization name is required').isLength({ max: 100 }),
        body('description').notEmpty().withMessage('Description is required').isLength({ max: 2000 }),
        body('location').trim().notEmpty().withMessage('Location is required'),
        body('contactEmail').trim().toLowerCase().matches(EMAIL_RE).withMessage('Valid contact email is required'),
        body('causes').optional().isArray().withMessage('Causes must be a list'),
        body('website').optional().trim(),
        body('logo').optional().trim(),
        body('contactPhone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
        body('address').optional({ values: 'falsy' }).trim().isLength({ max: 300 }),
        body('registrationNumber').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
        body('registrationDetails').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
        body('documents').optional().isArray({ max: 10 }).withMessage('Documents must be a list'),
      ];

const idParam = [param('id').isMongoId().withMessage('Invalid NGO id')];

router.get('/', ngoController.getNGOs);
router.get('/mine', protect, authorize('ngo', 'admin'), ngoController.getMyNGOs);
router.get('/:id', idParam, validate, ngoController.getNGO);
router.post('/', protect, authorize('ngo', 'admin'), ngoBody(), validate, ngoController.createNGO);
router.patch(
  '/:id/request-verification',
  protect,
  idParam,
  body('note').optional().trim().isLength({ max: 1000 }).withMessage('Note is too long'),
  validate,
  ngoController.requestVerification
);
router.patch('/:id', protect, idParam, ngoBody({ update: true }), validate, ngoController.updateNGO);
router.delete('/:id', protect, idParam, validate, ngoController.deleteNGO);

module.exports = router;