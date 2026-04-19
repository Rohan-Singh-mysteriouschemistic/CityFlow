const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
require('dotenv').config();

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // Attach user payload to socket
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 User connected: ${socket.user.user_id} (${socket.user.role}) - Socket ID: ${socket.id}`);

    // Join self-room (for direct notifications to this specific user)
    socket.join(`user_${socket.user.user_id}`);

    // Drivers join a zone to get broadcasted ride requests in their area
    socket.on('join_zone', (zoneId) => {
        if (socket.user.role === 'driver') {
            socket.join(`zone_${zoneId}`);
            logger.info(`Driver ${socket.user.user_id} joined zone_${zoneId}`);
        }
    });

    // Rider and Driver join a ride-specific room once matched
    socket.on('join_ride', (rideId) => {
        socket.join(`ride_${rideId}`);
        logger.info(`User ${socket.user.user_id} joined ride_${rideId}`);
    });

    // Driver emits live location which is pushed to everyone in the ride room (e.g. Rider)
    socket.on('location_update', (data) => {
        // Expected data payload: { rideId: X, lat: YY, lng: ZZ }
        if (socket.user.role === 'driver' && data.rideId) {
            io.to(`ride_${data.rideId}`).emit('driver_location', {
               driverId: socket.user.user_id,
               lat: data.lat,
               lng: data.lng,
               timestamp: new Date()
            });
        }
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 User disconnected: ${socket.user.user_id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};

module.exports = { initSocket, getIO };
