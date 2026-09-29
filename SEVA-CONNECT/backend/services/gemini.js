/**
 * Google Gemini wrapper for the Seva AI chatbot.
 *
 * The client is created lazily and every failure is swallowed into a null
 * result, so the API still boots (and the chatbot still answers, via the
 * data-driven fallback in chatbotService) when no key is configured.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_MODEL = 'gemini-2.0-flash';
const PLACEHOLDER = 'your_gemini_api_key';

let client = null;

function getApiKey() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return key && key !== PLACEHOLDER ? key : '';
}

function getModelName() {
  return (process.env.GEMINI_MODEL || '').trim() || DEFAULT_MODEL;
}

function isEnabled() {
  return Boolean(getApiKey());
}

function getClient() {
  if (!client) {
    client = new GoogleGenerativeAI(getApiKey());
  }
  return client;
}

/**
 * Runs a grounded chat turn.
 * Returns the model's reply text, or null when Gemini is unavailable or the
 * request fails — callers are expected to fall back in that case.
 */
async function generateReply({ systemInstruction, history = [], message }) {
  if (!isEnabled()) return null;

  try {
    const model = getClient().getGenerativeModel({
      model: getModelName(),
      systemInstruction,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 800,
      },
    });

    // The Gemini chat history must open with a user turn, so any stray
    // leading model turn is dropped before the conversation is replayed.
    let turns = history
      .filter((m) => m && typeof m.text === 'string' && m.text.trim())
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text.trim() }],
      }));
    if (turns.length && turns[0].role === 'model') turns = turns.slice(1);

    const result = turns.length
      ? await model.startChat({ history: turns }).sendMessage(message)
      : await model.generateContent(message);

    const text = result?.response?.text();
    return text && text.trim() ? text.trim() : null;
  } catch (error) {
    console.error('[CHATBOT] Gemini request failed:', error.message);
    return null;
  }
}

module.exports = { generateReply, isEnabled, getModelName };
