/**
 * Public announcement route.
 */
const router = require('express').Router();
const announcementController = require('../controllers/announcementController');

router.get('/', announcementController.listPublic);

module.exports = router;
