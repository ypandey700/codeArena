const Battle = require('../models/Battle');
const redis = require('../config/redis');
const { finishPlayer, formatBattleState, formatBattleEndShape } = require('../services/battleService');

const submitBattleCode = async (req, res) => {
  try {
    const { language, code } = req.body;
    if (!language || typeof code !== 'string' || !code || code.length > 20000) return res.status(400).json({ message: 'Language and code (maximum 20000 characters) are required' });
    const key = `ratelimit:submission:${req.user._id}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    if (count > 10) return res.status(429).json({ message: 'Maximum 10 submissions per minute' });
    const result = await finishPlayer(req.params.id, req.user._id, { language, code });
    if (!result.success) return res.status(400).json({ message: result.message });
    return res.json({ success: true, data: result.data });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getActiveBattle = async (req, res) => {
  try {
    const battle = await Battle.findOne({
      'players.user': req.user._id,
      status: { $in: ['pending', 'active', 'finalizing'] },
    }).populate('problem players.user');

    if (!battle) {
      return res.json({ success: true, data: { battle: null } });
    }

    const formatted = await formatBattleState(battle, req.user._id);

    return res.json({
      success: true,
      data: {
        battle: formatted,
        ...formatted,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getBattleById = async (req, res) => {
  try {
    const battle = await Battle.findById(req.params.id).select('+players.myTests').populate('problem players.user');
    if (!battle) {
      return res.status(404).json({ message: 'Battle not found' });
    }

    const isParticipant = battle.players.some((p) => String(p.user?._id || p.user) === String(req.user._id));
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const formatted = formatBattleEndShape(battle, req.user._id);

    return res.json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getMyBattles = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { 'players.user': req.user._id };

    const [battles, total] = await Promise.all([
      Battle.find(filter)
        .populate('players.user problem', 'username avatar rating title slug difficulty category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Battle.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        battles: battles.map((battle) => formatBattleEndShape(battle, req.user._id)),
        total,
        page,
        limit,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  submitBattleCode,
  getActiveBattle,
  getBattleById,
  getMyBattles,
};
