/**
 * Socket.IO real-time layer.
 * Clients connect with a JWT (via handshake.auth.token or an Authorization
 * header). Authenticated sockets join a personal room so targeted
 * notifications can be pushed per user.
 *
 * A socket is only accepted when the token is current (tokenVersion match), the
 * account is active, and the email address is verified — the same rules the
 * HTTP API enforces.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getAllowedOrigins } = require('../config/cors');
const { isEmailVerified } = require('../utils/email');

function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  // Exposed so services (notifications) can push without an HTTP request.
  attachSockets.getIO = () => io;

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error('User not found'));
      }
      const tokenVersion = typeof decoded.tv === 'number' ? decoded.tv : 0;
      if (tokenVersion !== (user.tokenVersion || 0)) {
        return next(new Error('Session has ended'));
      }
      if (user.accountStatus === 'suspended') {
        return next(new Error('Account suspended'));
      }
      if (!isEmailVerified(user)) {
        return next(new Error('Email not verified'));
      }
      socket.userId = String(user._id);
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`users:${socket.userId}`);
    socket.emit('connected', { ok: true, name: socket.user.name });
  });

  io.notifyUser = (userId, payload) => {
    io.to(`users:${userId}`).emit('notification:new', payload);
  };
  io.notifyAll = (payload) => {
    io.emit('notification:new', payload);
  };

  return io;
}

module.exports = attachSockets;
