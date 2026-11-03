const redis = require('../config/redis');

const rateLimit = async (req, res, next) => {
  try {
    if (!redis || redis.status !== 'ready') {
      return next();
    }

    const userId = req.user ? req.user._id : req.ip;
    const key = `ratelimit:submission:${userId}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }

    if (count > 10) {
      return res.status(429).json({ message: 'Too many requests. Please wait a minute.' });
    }

    next();
  } catch (err) {
    next();
  }
};

module.exports = rateLimit;
