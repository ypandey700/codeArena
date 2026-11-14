const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const redis = require('../config/redis');
const {
  initBattleEngine,
  enqueuePlayer,
  dequeuePlayer,
  acceptMatch,
  declineMatch,
  forfeitBattle,
  handleDisconnect,
  handleReconnect,
  getBattleState,
  handleChatMessage,
} = require('../services/battleService');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.split(' ')[1]
          : null);

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      socket.userId = String(user._id);
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);

    redis.incr(`user:connections:${userId}`).then((count) => {
      if (count === 1) {
        User.findByIdAndUpdate(userId, { isOnline: true }).catch(() => {});
      }
    }).catch(() => {});
    handleReconnect(userId).catch(() => {});

    socket.on('queue_join', async (data, ack) => {
      try {
        const mode = data?.mode || 'ranked_1v1';
        const result = await enqueuePlayer(userId, mode);
        if (typeof ack === 'function') ack(result);
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, message: err.message });
      }
    });

    socket.on('queue_leave', async (_, ack) => {
      try {
        const result = await dequeuePlayer(userId);
        if (typeof ack === 'function') ack(result);
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, message: err.message });
      }
    });

    socket.on('match_accept', async (data) => {
      try {
        const battleId = data?.battleId;
        if (battleId) await acceptMatch(battleId, userId);
      } catch (err) {
      }
    });

    socket.on('match_decline', async (data) => {
      try {
        const battleId = data?.battleId;
        if (battleId) await declineMatch(battleId, userId);
      } catch (err) {
      }
    });

    socket.on('battle_join', async (data, ack) => {
      try {
        const battleId = data?.battleId;
        if (!battleId) return;
        const state = await getBattleState(battleId, userId);
        if (state) {
          socket.emit('battle_state', state);
          if (typeof ack === 'function') ack({ success: true, data: state });
        }
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, message: err.message });
      }
    });

    socket.on('battle_forfeit', async (data) => {
      try {
        const battleId = data?.battleId;
        if (battleId) await forfeitBattle(battleId, userId);
      } catch (err) {
      }
    });

    socket.on('battle_chat', async (data) => {
      try {
        const { battleId, text } = data || {};
        if (battleId && text) {
          await handleChatMessage(battleId, userId, text);
        }
      } catch (err) {
      }
    });

    socket.on('disconnect', async () => {
      try {
        const remaining = await redis.decr(`user:connections:${userId}`);
        if (remaining <= 0) {
          await redis.del(`user:connections:${userId}`);
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
          await handleDisconnect(userId);
        }
      } catch (err) {
      }
    });
  });

  initBattleEngine(io);

  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
