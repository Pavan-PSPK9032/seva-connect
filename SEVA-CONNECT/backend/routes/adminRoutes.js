/**
 * Admin routes — every endpoint requires an authenticated, verified admin.
 *
 * Router-level `protect` + `authorize('admin')` means authorization is enforced
 * on the server for every route in this file, independent of the frontend.
 */
const router = require('express').Router();
const { body, param } = require('express-validator');

const adminController = require('../controllers/adminController');
const announcementController = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const idParam = (name = 'id') => param(name).isMongoId().withMessage(`Invalid ${name}`);

const ROLES = ['volunteer', 'ngo', 'admin'];
const EVENT_STATUSES = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled', 'archived'];

router.use(protect, authorize('admin'));

/* --------------------------------- Overview -------------------------------- */
router.get('/overview', adminController.overview);

/* ----------------------------------- Users --------------------------------- */
router.get('/users', adminController.listUsers);
router.get('/users/:id', idParam(), validate, adminController.getUser);

router.patch(
  '/users/:id/status',
  [idParam()],
  body('accountStatus').isIn(['active', 'suspended']).withMessage('Status must be active or suspended'),
  validate,
  adminController.setUserStatus
);

router.patch(
  '/users/:id/role',
  [idParam()],
  body('role').isIn(ROLES).withMessage('Role must be volunteer, ngo or admin'),
  validate,
  adminController.setUserRole
);

/* --------------------------------- Volunteers ------------------------------- */
router.get('/volunteers', adminController.listVolunteers);
router.get('/volunteers/:id', idParam(), validate, adminController.getVolunteer);

router.post(
  '/volunteers/:id/assign',
  [idParam()],
  body('eventId').isMongoId().withMessage('A valid activity id is required'),
  validate,
  adminController.assignVolunteer
);

/* ------------------------------------ NGOs ---------------------------------- */
router.get('/ngos', adminController.listNGOs);
router.get('/ngos/:id', idParam(), validate, adminController.getNGO);

router.patch(
  '/ngos/:id/verify',
  [idParam()],
  body('verified').isBoolean().withMessage('verified must be true or false').toBoolean(),
  body('note').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }),
  validate,
  adminController.setNGOVerified
);

router.patch(
  '/ngos/:id/status',
  [idParam()],
  body('status').isIn(['active', 'suspended']).withMessage('Status must be active or suspended'),
  validate,
  adminController.setNGOStatus
);

/* --------------------------------- Activities ------------------------------- */
router.get('/events', adminController.listEvents);

router.patch(
  '/events/:id/status',
  [idParam()],
  body('status').isIn(EVENT_STATUSES).withMessage('Invalid event status'),
  validate,
  adminController.setEventStatus
);

/* -------------------------------- Applications ------------------------------ */
router.get('/applications', adminController.listApplications);

/* ----------------------------------- Audit ---------------------------------- */
router.get('/audit', adminController.listAudit);

/* ---------------------------------- Reports --------------------------------- */
router.get('/reports', adminController.reports);
router.get('/export', adminController.exportCsv);

/* --------------------------------- Settings --------------------------------- */
router.get('/settings', adminController.getSettings);
router.patch(
  '/settings',
  body('platformName').optional().trim().isLength({ min: 2, max: 80 }),
  body('supportEmail')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Support email must be a valid address'),
  body('registrationOpen').optional().isBoolean().toBoolean(),
  body('maintenanceNotice').optional().trim().isLength({ max: 500 }),
  body('announcementBanner').optional().trim().isLength({ max: 300 }),
  validate,
  adminController.updateSettings
);

router.get('/profile', adminController.getProfile);
router.patch(
  '/profile',
  body('name').optional().trim().isLength({ min: 2, max: 60 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
  body('profileImage').optional().trim().isLength({ max: 500 }),
  body('location').optional().trim().isLength({ max: 100 }),
  body('notificationPrefs.inApp').optional().isBoolean(),
  body('notificationPrefs.email').optional().isBoolean(),
  body('notificationPrefs.reminders').optional().isBoolean(),
  validate,
  adminController.updateProfile
);

router.get('/security', adminController.getSecurity);
router.post('/security/logout-all', adminController.logoutAllSessions);

/* ------------------------------- Announcements ------------------------------ */
router.get('/announcements', announcementController.listAdmin);
router.post(
  '/announcements',
  body('title').trim().isLength({ min: 2, max: 120 }).withMessage('Title must be 2–120 characters'),
  body('message').trim().isLength({ min: 2, max: 1000 }).withMessage('Message must be 2–1000 characters'),
  body('link').optional({ values: 'falsy' }).trim().isLength({ max: 300 }),
  body('audience').optional().isIn(['all', 'volunteer', 'ngo']),
  body('status').optional().isIn(['draft', 'published', 'archived']),
  body('expiresAt').optional({ values: 'falsy' }).isISO8601().toDate(),
  validate,
  announcementController.create
);

router.patch(
  '/announcements/:id',
  [idParam()],
  body('title').optional().trim().isLength({ min: 2, max: 120 }),
  body('message').optional().trim().isLength({ min: 2, max: 1000 }),
  body('link').optional({ values: 'falsy' }).trim().isLength({ max: 300 }),
  body('audience').optional().isIn(['all', 'volunteer', 'ngo']),
  body('status').optional().isIn(['draft', 'published', 'archived']),
  body('expiresAt').optional({ values: 'falsy' }).isISO8601().toDate(),
  validate,
  announcementController.update
);

router.delete('/announcements/:id', idParam(), validate, announcementController.remove);

module.exports = router;
