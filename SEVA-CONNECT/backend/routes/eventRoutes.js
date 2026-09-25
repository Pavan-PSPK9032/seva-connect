/**
 * Event routes.
 * Public GET /api/events — listing, search, filters, pagination.
 * Creation/registration/attendance are protected routes in later phases.
 */
const router = require('express').Router();
const eventController = require('../controllers/eventController');

router.get('/', eventController.getEvents);

module.exports = router;