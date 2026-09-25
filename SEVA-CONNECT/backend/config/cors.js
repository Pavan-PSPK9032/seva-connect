/**
 * Shared CORS origin configuration used by both the HTTP app and Socket.IO.
 * Origins are read from the CLIENT_URL environment variable (comma separated).
 */
function getAllowedOrigins() {
  return (process.env.CLIENT_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

module.exports = { getAllowedOrigins };