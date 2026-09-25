/**
 * Seva Connect API — Express application.
 * Security middleware, mounted routers, and error handling live here so the
 * app can be imported independently (tests, tools) while server.js handles
 * startup and real-time layers.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { getAllowedOrigins } = require('./config/cors');

const app = express();

/* ----------------------------- Security layer ---------------------------- */

app.use(helmet());

const allowedOrigins = getAllowedOrigins();
app.use(
  cors({
    origin: allowedOrigins.length
      ? allowedOrigins
      : (origin, cb) => cb(null, origin || true),
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
app.use('/api/ngos', require('./routes/ngoRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));

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
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.status === 404 ? err.message : 'Internal server error. Please try again later.',
  });
});

module.exports = app;