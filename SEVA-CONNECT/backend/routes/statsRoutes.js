/**
 * Public statistics routes.
 */
const router = require('express').Router();
const statsController = require('../controllers/statsController');

router.get('/public', statsController.getPublicStats);
router.get('/impact', statsController.getImpact);
router.get('/leaderboard', statsController.getLeaderboard);

module.exports = router;
