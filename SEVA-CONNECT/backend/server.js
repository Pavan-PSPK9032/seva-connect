/**
 * Seva Connect API — entry point.
 * Connects to MongoDB Atlas, then starts the HTTP server and attaches
 * Socket.IO for real-time notifications.
 */
require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  const server = http.createServer(app);
  require('./sockets')(server);
  server.listen(PORT, () => {
    console.log(`[API] Seva Connect server running on port ${PORT}`);
    console.log(`[API] http://localhost:${PORT}/api/health`);
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('[API] Unhandled rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('[API] Uncaught exception:', err);
  process.exit(1);
});