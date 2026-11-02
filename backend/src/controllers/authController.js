const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const redis = require('../config/redis');

const registerSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(20, 'Username must be at most 20 characters'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
};

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const register = async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: parseResult.error.errors[0].message });
    }

    const { username, email, password } = parseResult.data;
    const lowerUsername = username.toLowerCase();
    const lowerEmail = email.toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ username: lowerUsername }, { email: lowerEmail }],
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: lowerUsername,
      email: lowerEmail,
      passwordHash,
    });

    const { accessToken, refreshToken } = generateTokens(user._id);

    await redis.set(`refresh:${user._id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);
    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const identifier = req.body.email || req.body.username || req.body.identifier;
    const password = req.body.password;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Username/email and password are required' });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();

    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }],
    }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    await redis.set(`refresh:${user._id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);
    setRefreshCookie(res, refreshToken);

    return res.json({
      success: true,
      data: {
        user: user.toJSON(),
        accessToken,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (tokenErr) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const storedToken = await redis.get(`refresh:${decoded.userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const accessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });

    return res.json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        if (decoded?.userId) {
          await redis.del(`refresh:${decoded.userId}`);
        }
      } catch (err) {
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.json({
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
};
