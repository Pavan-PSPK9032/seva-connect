/**
 * Admin routes — every endpoint requires an authenticated admin.
 */
const router = require('express').Router();
const { body, param } = require('express-validator');

const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect, authorize('admin'));

router.get('/overview', adminController.overview);
router.get('/users', adminController.listUsers);
router.get('/ngos', adminController.listNGOs);
router.get('/events', adminController.listEvents);
router.get('/applications', adminController.listApplications);
router.get('/export', adminController.exportCsv);
router.get('/audit', adminController.listAudit);

router.patch(
  '/users/:id/status',
  [param('id').isMongoId().withMessage('Invalid user id')],
  body('accountStatus').isIn(['active', 'suspended']).withMessage('Status must be active or suspended'),
  validate,
  adminController.setUserStatus
);

router.patch(
  '/ngos/:id/verify',
  [param('id').isMongoId().withMessage('Invalid NGO id')],
  body('verified').isBoolean().withMessage('verified must be true or false').toBoolean(),
  validate,
  adminController.setNGOVerified
);

router.patch(
  '/events/:id/status',
  [param('id').isMongoId().withMessage('Invalid event id')],
  body('status')
    .isIn(['upcoming', 'ongoing', 'completed', 'cancelled'])
    .withMessage('Invalid event status'),
  validate,
  adminController.setEventStatus
);

module.exports = router;
