/**
 * Chatbot routes (Seva AI).
 * Public: GET /status, GET /suggestions, POST /message
 *
 * `optionalAuth` is used instead of `protect` so guests can chat too — the
 * assistant simply personalises its answers when a valid token is supplied.
 * A dedicated rate limit keeps the model bill bounded.
 */
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const chatbotController = require('../controllers/chatbotController');
const { optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const MAX_HISTORY = 10;

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'You are sending messages too quickly. Please wait a moment and try again.',
  },
});

const messageRules = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Please type a message.')
    .isLength({ max: 1000 })
    .withMessage('Messages cannot exceed 1000 characters.'),
  body('history')
    .optional({ values: 'falsy' })
    .isArray({ max: MAX_HISTORY })
    .withMessage(`History must be a list of at most ${MAX_HISTORY} messages.`),
  body('history.*.role')
    .optional()
    .isIn(['user', 'assistant'])
    .withMessage('History roles must be "user" or "assistant".'),
  body('history.*.text')
    .optional()
    .isString()
    .withMessage('History entries must contain text.')
    .isLength({ max: 1000 })
    .withMessage('History text cannot exceed 1000 characters.'),
];

router.get('/status', chatbotController.getStatus);
router.get('/suggestions', optionalAuth, chatbotController.getSuggestions);
router.post('/message', chatLimiter, optionalAuth, messageRules, validate, chatbotController.sendMessage);

module.exports = router;
