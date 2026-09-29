/**
 * Chatbot controllers (Seva AI).
 * Public:  GET  /api/chatbot/suggestions — starter prompts (personalised when signed in)
 *          POST /api/chatbot/message    — one grounded chat turn
 *          GET  /api/chatbot/status     — whether the Gemini model is configured
 */
const chatbotService = require('../services/chatbotService');

// POST /api/chatbot/message
async function sendMessage(req, res, next) {
  try {
    const { message, history } = req.body;

    const result = await chatbotService.answer({
      user: req.user || null,
      message,
      history: Array.isArray(history) ? history : [],
    });

    return res.json({
      success: true,
      message: result.mode === 'ai' ? 'Reply generated.' : 'Reply generated (local assistant mode).',
      data: {
        reply: result.reply,
        mode: result.mode,
        grounded: result.grounded,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/chatbot/suggestions
async function getSuggestions(req, res, next) {
  try {
    return res.json({
      success: true,
      data: { suggestions: chatbotService.getSuggestions(req.user || null) },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/chatbot/status
async function getStatus(req, res, next) {
  try {
    return res.json({
      success: true,
      data: {
        provider: 'gemini',
        model: chatbotService.getModel(),
        aiEnabled: chatbotService.isEnabled(),
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { sendMessage, getSuggestions, getStatus };
