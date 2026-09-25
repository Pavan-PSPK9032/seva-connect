/**
 * Socket.IO real-time layer.
 * Clients connect with a JWT (via handshake.auth.token or an Authorization
 * header). Authenticated sockets join a personal room so targeted
 * notifications can be pushed per user.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getAllowedOrigins } = require('../config/cors');

function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins().length ? getAllowedOrigins() : true,
      credentials: true,
    },
  });

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