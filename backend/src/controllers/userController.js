const User = require('../models/User');

const searchUsers = async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {
      _id: { $ne: req.user._id },
    };

    if (q) {
      filter.username = { $regex: `^${q}`, $options: 'i' };
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('username avatar rating xp bio college isOnline lastSeen stats badges')
        .skip(skip)
        .limit(limit)
        .sort({ rating: -1 }),
      User.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        users,
        total,
        page,
        limit,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const username = String(req.params.username).toLowerCase().trim();

    const user = await User.findOne({ username }).select(
      'username avatar bio college rating xp badges stats isOnline lastSeen createdAt friends'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateMe = async (req, res) => {
  try {
    const { bio, college, avatar, username } = req.body;

    if (username !== undefined) {
      const cleanUsername = String(username).trim().toLowerCase();
      if (cleanUsername.length < 3 || cleanUsername.length > 20) {
        return res.status(400).json({ message: 'Username must be between 3 and 20 characters' });
      }

      if (cleanUsername !== req.user.username) {
        const existing = await User.findOne({
          username: cleanUsername,
          _id: { $ne: req.user._id },
        });

        if (existing) {
          return res.status(400).json({ message: 'Username already taken' });
        }

        req.user.username = cleanUsername;
      }
    }

    if (bio !== undefined) {
      req.user.bio = String(bio).trim();
    }

    if (college !== undefined) {
      req.user.college = String(college).trim();
    }

    if (avatar !== undefined) {
      req.user.avatar = String(avatar).trim();
    }

    await req.user.save();

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
  searchUsers,
  getUserProfile,
  updateMe,
};
