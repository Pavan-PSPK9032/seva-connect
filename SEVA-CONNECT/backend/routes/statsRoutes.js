/**
 * Public statistics routes.
 */
const router = require('express').Router();
const statsController = require('../controllers/statsController');

router.get('/public', statsController.getPublicStats);

module.exports = router;
