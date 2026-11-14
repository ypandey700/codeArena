const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const passport = require('../config/passport');
const User = require('../models/User');
const redis = require('../config/redis');
const { getTier } = require('../utils/tier');

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
      authProviders: ['local'],
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

    if (!user.passwordHash) {
      const providers = [];
      if (user.authProviders?.includes('google') || user.googleId) providers.push('Google');
      if (user.authProviders?.includes('github') || user.githubId) providers.push('GitHub');
      const providerText = providers.length > 0 ? providers.join('/') : 'Google/GitHub';
      return res.status(400).json({ message: `This account uses ${providerText} login` });
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
    const userObj = req.user.toObject();
    const rank = (await User.countDocuments({ rating: { $gt: req.user.rating } })) + 1;
    userObj.rank = rank;
    userObj.tier = getTier(req.user.rating);
    return res.json({
      success: true,
      data: {
        user: userObj,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const googleAuth = (req, res, next) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${clientUrl}/auth/callback?error=google_not_configured`);
  }
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
  });
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
    session: false,
  })(req, res, next);
};

const googleCallback = (req, res, next) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  if (req.query.error) {
    return res.redirect(`${clientUrl}/auth/callback?error=${encodeURIComponent(req.query.error)}`);
  }
  const state = req.query.state;
  const savedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  if (!state || !savedState || state !== savedState) {
    return res.redirect(`${clientUrl}/auth/callback?error=invalid_state`);
  }
  passport.authenticate('google', { session: false }, async (err, user) => {
    if (err || !user) {
      const code = err?.message || 'auth_failed';
      return res.redirect(`${clientUrl}/auth/callback?error=${encodeURIComponent(code)}`);
    }
    try {
      const { accessToken, refreshToken } = generateTokens(user._id);
      await redis.set(`refresh:${user._id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);
      setRefreshCookie(res, refreshToken);
      return res.redirect(`${clientUrl}/auth/callback`);
    } catch {
      return res.redirect(`${clientUrl}/auth/callback?error=server_error`);
    }
  })(req, res, next);
};

const githubAuth = (req, res, next) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return res.redirect(`${clientUrl}/auth/callback?error=github_not_configured`);
  }
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
  });
  passport.authenticate('github', {
    scope: ['user:email'],
    state,
    session: false,
  })(req, res, next);
};

const githubCallback = (req, res, next) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  if (req.query.error) {
    return res.redirect(`${clientUrl}/auth/callback?error=${encodeURIComponent(req.query.error)}`);
  }
  const state = req.query.state;
  const savedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  if (!state || !savedState || state !== savedState) {
    return res.redirect(`${clientUrl}/auth/callback?error=invalid_state`);
  }
  passport.authenticate('github', { session: false }, async (err, user) => {
    if (err || !user) {
      const code = err?.message || 'auth_failed';
      return res.redirect(`${clientUrl}/auth/callback?error=${encodeURIComponent(code)}`);
    }
    try {
      const { accessToken, refreshToken } = generateTokens(user._id);
      await redis.set(`refresh:${user._id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);
      setRefreshCookie(res, refreshToken);
      return res.redirect(`${clientUrl}/auth/callback`);
    } catch {
      return res.redirect(`${clientUrl}/auth/callback?error=server_error`);
    }
  })(req, res, next);
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
  googleAuth,
  googleCallback,
  githubAuth,
  githubCallback,
};
