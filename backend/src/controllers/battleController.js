const Battle = require('../models/Battle');
const Problem = require('../models/Problem');
const Submission = require('../models/Submission');
const redis = require('../config/redis');
const { runSubmission } = require('../services/codeRunnerService');
const { finishBattle, formatBattleState, formatBattleEndShape } = require('../services/battleService');
const { getIO } = require('../sockets');

const submitBattleCode = async (req, res) => {
  try {
    const userId = String(req.user._id);
    const rateKey = `ratelimit:submission:${userId}`;
    const count = await redis.incr(rateKey);
    if (count === 1) {
      await redis.expire(rateKey, 60);
    }
    if (count > 10) {
      return res.status(429).json({ message: 'Rate limit exceeded: maximum 10 submissions per minute' });
    }

    const { id } = req.params;
    const { language, code } = req.body;

    if (!language || !code) {
      return res.status(400).json({ message: 'Language and code are required' });
    }

    const battle = await Battle.findById(id);
    if (!battle) {
      return res.status(404).json({ message: 'Battle not found' });
    }

    const isParticipant = battle.players.some((p) => String(p.user) === String(req.user._id));
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not a participant in this battle' });
    }

    if (battle.status !== 'active') {
      return res.status(400).json({ message: 'Battle is not active' });
    }

    if (new Date() > new Date(battle.endsAt)) {
      return res.status(400).json({ message: 'Battle time has expired' });
    }

    const problem = await Problem.findById(battle.problem).select('+hiddenTestCases');
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    const sampleTestCases = problem.sampleTestCases || [];
    const hiddenTestCases = problem.hiddenTestCases || [];
    const allTests = [...sampleTestCases, ...hiddenTestCases];

    const result = await runSubmission({
      language,
      code,
      testCases: allTests,
      timeLimitMs: problem.timeLimitMs || 2000,
      memoryLimitMb: problem.memoryLimitMb || 256,
    });

    const sanitizedResults = (result.testResults || []).map((tr, idx) => {
      if (idx < sampleTestCases.length) return tr;
      return {
        passed: tr.passed,
        output: '',
        expected: '',
        timeMs: tr.timeMs,
      };
    });

    await Submission.create({
      user: req.user._id,
      problem: problem._id,
      battle: battle._id,
      language,
      code,
      status: result.status,
      error: result.error || '',
      testResults: sanitizedResults,
      passedCount: result.passedCount,
      totalCount: result.totalCount,
      executionTimeMs: result.executionTimeMs,
    });

    const freshBattle = await Battle.findById(battle._id);
    if (!freshBattle) {
      return res.status(404).json({ message: 'Battle not found' });
    }

    const player = freshBattle.players.find((p) => String(p.user) === String(req.user._id));
    const opponent = freshBattle.players.find((p) => String(p.user) !== String(req.user._id));

    if (player) {
      player.lastSubmissionAt = new Date();
      player.totalTests = result.totalCount;
      if (result.passedCount > player.bestPassed) {
        player.bestPassed = result.passedCount;
        player.set('runtimeMs', result.executionTimeMs, { strict: false });
      } else if (result.passedCount === player.bestPassed && (player.get('runtimeMs') == null || (result.status === 'accepted' && result.executionTimeMs < player.get('runtimeMs')))) {
        player.set('runtimeMs', result.executionTimeMs, { strict: false });
      }
      if (result.passedCount === result.totalCount && result.status === 'accepted' && !player.solvedAt) {
        player.solvedAt = new Date();
      }
    }

    freshBattle.timeline.push({
      user: req.user._id,
      passedCount: result.passedCount,
      totalCount: result.totalCount,
      at: new Date(),
    });

    await freshBattle.save();

    const io = getIO();
    io?.to(`user:${req.user._id}`).emit('submission_result', {
      status: result.status,
      passedCount: result.passedCount,
      totalCount: result.totalCount,
      timeMs: result.executionTimeMs,
    });

    if (opponent) {
      io?.to(`user:${opponent.user}`).emit('opponent_progress', {
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        at: new Date(),
      });
    }

    if (freshBattle.status === 'active' && result.status === 'accepted' && result.passedCount === result.totalCount) {
      await finishBattle(freshBattle._id, req.user._id, 'solved');
    }

    return res.json({
      success: true,
      data: {
        status: result.status,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        timeMs: result.executionTimeMs,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getActiveBattle = async (req, res) => {
  try {
    const battle = await Battle.findOne({
      'players.user': req.user._id,
      status: { $in: ['pending', 'active'] },
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
    const battle = await Battle.findById(req.params.id).populate('problem players.user');
    if (!battle) {
      return res.status(404).json({ message: 'Battle not found' });
    }

    const isParticipant = battle.players.some((p) => String(p.user?._id || p.user) === String(req.user._id));
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const formatted = formatBattleEndShape(battle);

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
        battles,
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
