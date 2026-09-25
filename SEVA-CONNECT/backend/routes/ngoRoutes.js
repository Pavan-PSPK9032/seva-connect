/**
 * NGO routes.
 * Public GET /api/ngos — listing, search, filters, pagination.
 * Creation/update/verification are protected routes in later phases.
 */
const router = require('express').Router();
const ngoController = require('../controllers/ngoController');

router.get('/', ngoController.getNGOs);

module.exports = router;