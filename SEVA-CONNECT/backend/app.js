/**
 * Seva Connect API — Express application.
 * Security middleware, mounted routers, and error handling live here so the
 * app can be imported independently (tests, tools) while server.js handles
 * startup and real-time layers.
 */
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { isAllowedOrigin } = require('./config/cors');

const app = express();

/* ----------------------------- Security layer ---------------------------- */

app.use(helmet());

app.use('/favicon.ico', express.static(path.join(__dirname, 'public', 'favicon.ico')));

app.use(
  cors({
    // Only configured origins are reflected. A disallowed origin simply gets no
    // CORS headers, which the browser turns into a blocked response.
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  })
);

/* --------------------------------- Routes --------------------------------- */

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/ngos', require('./routes/ngoRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/certificates', require('./routes/certificateRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/chatbot', require('./routes/chatbotRoutes'));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'Seva Connect API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Seva Connect API is running. See /api/health.' });
});

/* ------------------------------ Error handling ---------------------------- */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[ERR] ${req.method} ${req.originalUrl}:`, err.message);

  // Unique-index violations (including registration races that slip past the
  // pre-check) must be a clear 409, never a generic 500.
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    const message = fields.includes('email')
      ? 'An account with this email already exists. Please log in or reset your password.'
      : 'A record with these details already exists.';
    return res.status(409).json({ success: false, code: 'DUPLICATE_KEY', message });
  }

  // Body-parser rejects malformed JSON before any route runs.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      code: 'MALFORMED_JSON',
      message: 'Malformed JSON in the request body. Please check the data and try again.',
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large.',
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid identifier supplied.',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.status === 404 ? err.message : 'Internal server error. Please try again later.',
  });
});

module.exports = app;