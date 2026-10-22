/**
 * Certificate routes. Verification is public so anyone can check a code.
 */
const router = require('express').Router();

const certificateController = require('../controllers/certificateController');
const { protect } = require('../middleware/auth');

router.get('/mine', protect, certificateController.getMine);
router.get('/:code', certificateController.verify);

module.exports = router;
