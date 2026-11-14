const Battle = require('../models/Battle');
const Problem = require('../models/Problem');
const Submission = require('../models/Submission');
const User = require('../models/User');
const redis = require('../config/redis');
const { getTier } = require('../utils/tier');

const QUEUE_KEY = 'matchmaking:queue:ranked_1v1';
const MATCH_LUA = `
if redis.call('ZSCORE', KEYS[1], ARGV[1]) and redis.call('ZSCORE', KEYS[1], ARGV[2]) then
  redis.call('ZREM', KEYS[1], ARGV[1], ARGV[2])
  redis.call('HDEL', KEYS[2], ARGV[1], ARGV[2])
  return 1
else
  return 0
end
`;

let ioInstance = null;
let matcherInterval = null;
let queueStatusInterval = null;

const battleTimers = {};
const acceptTimers = {};
const disconnectTimers = {};

const getBattleDurationSeconds = () => parseInt(process.env.BATTLE_DURATION_SECONDS, 10) || 900;
const getReconnectGraceSeconds = () => parseInt(process.env.RECONNECT_GRACE_SECONDS, 10) || 30;
const getAcceptWindowSeconds = () => parseInt(process.env.ACCEPT_WINDOW_SECONDS, 10) || 30;

const getUserId = (u) => (u && u._id ? String(u._id) : String(u));

const toTimeMs = (val) => {
  if (!val) return null;
  if (typeof val === 'number') return val;
  const t = new Date(val).getTime();
  return isNaN(t) ? null : t;
};

const cleanProblem = (problem) => {
  if (!problem) return null;
  const p = problem.toObject ? problem.toObject() : { ...problem };
  delete p.hiddenTestCases;
  return p;
};

const setIO = (io) => {
  ioInstance = io;
};

const formatBattleState = async (battle, userId) => {
  const me = battle.players.find((p) => getUserId(p.user) === String(userId));
  const opp = battle.players.find((p) => getUserId(p.user) !== String(userId));
  const oppUser = opp && opp.user && typeof opp.user === 'object' && opp.user.username ? opp.user : null;
  const oppRating = oppUser ? (oppUser.rating || opp.ratingBefore || 1200) : (opp ? opp.ratingBefore : 1200);

  const opponent = opp ? {
    _id: oppUser ? String(oppUser._id) : getUserId(opp.user),
    username: oppUser ? oppUser.username : '',
    avatar: oppUser ? (oppUser.avatar || '') : '',
    rating: oppRating,
    tier: getTier(oppRating),
  } : null;

  const formatStatePlayer = (p) => {
    const u = p && p.user && typeof p.user === 'object' && p.user.username ? p.user : null;
    return {
      userId: getUserId(p?.user),
      username: u ? u.username : '',
      avatar: u ? (u.avatar || '') : '',
      passedCount: p ? p.bestPassed : 0,
      totalTests: p ? p.totalTests : 0,
      runtimeMs: p ? (typeof p.get === 'function' ? p.get('runtimeMs') : p.runtimeMs) ?? null : null,
      ratingBefore: p ? p.ratingBefore : 1200,
      ratingAfter: p ? p.ratingAfter : null,
      ratingDelta: p ? p.ratingDelta : null,
      xpGained: p ? p.xpGained : 0,
    };
  };

  const players = (battle.players || []).map(formatStatePlayer);

  if (battle.status === 'pending') {
    const myUser = me && me.user && typeof me.user === 'object' && me.user.username ? me.user : null;
    const myRating = myUser ? (myUser.rating || me.ratingBefore || 1200) : (me ? me.ratingBefore : 1200);
    const expMe = 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
    const win = Math.round(32 * (1 - expMe));
    const loss = Math.round(32 * (0 - expMe));

    return {
      battleId: String(battle._id),
      status: battle.status,
      serverNow: Date.now(),
      acceptDeadline: toTimeMs(battle.acceptDeadline),
      opponent,
      players,
      problem: battle.problem ? {
        title: battle.problem.title,
        difficulty: battle.problem.difficulty,
        category: battle.problem.category,
      } : null,
      ratingPreview: { win, loss },
    };
  }

  const chatKey = `battle:chat:${battle._id}`;
  const rawMsgs = await redis.lrange(chatKey, 0, -1);
  const lastChatMessages = rawMsgs
    .map((m) => {
      try {
        return JSON.parse(m);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const base = {
    battleId: String(battle._id),
    status: battle.status,
    serverNow: Date.now(),
    startedAt: toTimeMs(battle.startedAt),
    endsAt: toTimeMs(battle.endsAt),
    opponent,
    players,
    problem: cleanProblem(battle.problem),
    ownProgress: {
      bestPassed: me ? me.bestPassed : 0,
      totalTests: me ? me.totalTests : 0,
      runtimeMs: me ? (typeof me.get === 'function' ? me.get('runtimeMs') : me.runtimeMs) ?? null : null,
    },
    opponentProgress: {
      bestPassed: opp ? opp.bestPassed : 0,
      totalTests: opp ? opp.totalTests : 0,
      runtimeMs: opp ? (typeof opp.get === 'function' ? opp.get('runtimeMs') : opp.runtimeMs) ?? null : null,
    },
    lastChatMessages,
  };

  if (battle.status === 'finished') {
    base.winner = battle.winner ? String(battle.winner) : null;
    base.reason = battle.reason || null;
  }

  return base;
};

const formatBattleEndShape = (battle) => {
  const startedTime = battle.startedAt ? toTimeMs(battle.startedAt) : null;
  const p0 = battle.players[0];
  const p1 = battle.players[1];
  const u0 = p0 && p0.user;
  const u1 = p1 && p1.user;

  const formatPlayer = (player, userDoc) => ({
    userId: getUserId(player?.user || userDoc),
    username: userDoc && typeof userDoc === 'object' && userDoc.username ? userDoc.username : '',
    avatar: userDoc && typeof userDoc === 'object' && userDoc.avatar ? userDoc.avatar : '',
    passedCount: player ? player.bestPassed : 0,
    totalTests: player ? player.totalTests : 0,
    solveTimeMs: player && player.solvedAt && startedTime ? Math.max(0, toTimeMs(player.solvedAt) - startedTime) : null,
    runtimeMs: player ? (typeof player.get === 'function' ? player.get('runtimeMs') : player.runtimeMs) ?? null : null,
    ratingBefore: player ? player.ratingBefore : 1200,
    ratingAfter: player ? player.ratingAfter : null,
    ratingDelta: player ? player.ratingDelta : null,
    xpGained: player ? player.xpGained : 0,
  });

  return {
    battleId: String(battle._id),
    status: battle.status,
    winner: battle.winner ? String(battle.winner) : null,
    reason: battle.reason || null,
    problem: battle.problem && typeof battle.problem === 'object' ? {
      title: battle.problem.title,
      slug: battle.problem.slug,
      difficulty: battle.problem.difficulty,
      category: battle.problem.category,
    } : null,
    players: [formatPlayer(p0, u0), formatPlayer(p1, u1)],
    timeline: (battle.timeline || []).map((t) => ({
      user: String(t.user),
      passedCount: t.passedCount,
      totalCount: t.totalCount,
      at: toTimeMs(t.at),
    })),
  };
};

const enqueuePlayer = async (userId, mode = 'ranked_1v1') => {
  const cooldown = await redis.get(`cooldown:${userId}`);
  if (cooldown) {
    return { success: false, message: 'Queue cooldown active' };
  }

  const existingRank = await redis.zrank(QUEUE_KEY, String(userId));
  if (existingRank !== null) {
    return { success: false, message: 'Already in queue' };
  }

  const inBattle = await Battle.findOne({
    'players.user': userId,
    status: { $in: ['pending', 'active'] },
  });
  if (inBattle) {
    return { success: false, message: 'Already in a battle' };
  }

  const user = await User.findById(userId);
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  await redis.zadd(QUEUE_KEY, user.rating || 1200, String(userId));
  await redis.hset('matchmaking:times', String(userId), Date.now());
  return { success: true, message: 'Joined queue' };
};

const dequeuePlayer = async (userId) => {
  await redis.zrem(QUEUE_KEY, String(userId));
  await redis.hdel('matchmaking:times', String(userId));
  return { success: true, message: 'Left queue' };
};

const createMatchedBattle = async (userIdA, userIdB) => {
  const [userA, userB] = await Promise.all([
    User.findById(userIdA),
    User.findById(userIdB),
  ]);
  if (!userA || !userB) return;

  const [solvedA, solvedB] = await Promise.all([
    Submission.distinct('problem', { user: userA._id, status: 'accepted' }),
    Submission.distinct('problem', { user: userB._id, status: 'accepted' }),
  ]);
  const excluded = [...new Set([...solvedA.map(String), ...solvedB.map(String)])];

  let problem = await Problem.findOne({
    _id: { $nin: excluded },
    difficulty: { $in: ['easy', 'medium'] },
  });
  if (!problem) {
    problem = await Problem.findOne({ _id: { $nin: excluded } });
  }
  if (!problem) {
    problem = await Problem.findOne({ difficulty: { $in: ['easy', 'medium'] } });
  }
  if (!problem) {
    problem = await Problem.findOne();
  }
  if (!problem) return;

  const problemDoc = await Problem.findById(problem._id).select('+hiddenTestCases');
  const totalTests = (problemDoc?.sampleTestCases?.length || 0) + (problemDoc?.hiddenTestCases?.length || 0);

  const acceptWindow = getAcceptWindowSeconds();
  const acceptDeadline = new Date(Date.now() + acceptWindow * 1000);
  const battle = await Battle.create({
    players: [
      { user: userA._id, ratingBefore: userA.rating, response: 'pending', totalTests },
      { user: userB._id, ratingBefore: userB.rating, response: 'pending', totalTests },
    ],
    problem: problem._id,
    mode: 'ranked_1v1',
    status: 'pending',
    acceptDeadline,
  });

  acceptTimers[battle._id] = setTimeout(() => {
    onAcceptTimeout(battle._id);
  }, acceptWindow * 1000);

  const rA = userA.rating;
  const rB = userB.rating;
  const expA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  const expB = 1 - expA;

  const winA = Math.round(32 * (1 - expA));
  const lossA = Math.round(32 * (0 - expA));
  const winB = Math.round(32 * (1 - expB));
  const lossB = Math.round(32 * (0 - expB));

  const totalA = (userA.stats?.wins || 0) + (userA.stats?.losses || 0);
  const totalB = (userB.stats?.wins || 0) + (userB.stats?.losses || 0);
  const winRateA = totalA > 0 ? `${Math.round(((userA.stats.wins || 0) / totalA) * 100)}%` : '--';
  const winRateB = totalB > 0 ? `${Math.round(((userB.stats.wins || 0) / totalB) * 100)}%` : '--';

  const probPreview = {
    title: problem.title,
    difficulty: problem.difficulty,
    category: problem.category,
  };

  ioInstance?.to(`user:${userA._id}`).emit('match_found', {
    battleId: battle._id,
    acceptDeadline,
    serverNow: Date.now(),
    opponent: {
      username: userB.username,
      avatar: userB.avatar,
      rating: userB.rating,
      tier: getTier(userB.rating),
      winRate: winRateB,
      streak: userB.stats?.streak || 0,
    },
    problem: probPreview,
    ratingPreview: { win: winA, loss: lossA },
  });

  ioInstance?.to(`user:${userB._id}`).emit('match_found', {
    battleId: battle._id,
    acceptDeadline,
    serverNow: Date.now(),
    opponent: {
      username: userA.username,
      avatar: userA.avatar,
      rating: userA.rating,
      tier: getTier(userA.rating),
      winRate: winRateA,
      streak: userA.stats?.streak || 0,
    },
    problem: probPreview,
    ratingPreview: { win: winB, loss: lossB },
  });
};

const onAcceptTimeout = async (battleId) => {
  delete acceptTimers[battleId];
  const battle = await Battle.findOneAndUpdate(
    { _id: battleId, status: 'pending' },
    { status: 'cancelled' },
    { new: true }
  ).populate('players.user');
  if (!battle) return;

  const p0 = battle.players[0];
  const p1 = battle.players[1];
  const id0 = getUserId(p0.user);
  const id1 = getUserId(p1.user);

  ioInstance?.to(`user:${id0}`).emit('match_cancelled', { battleId, reason: 'timeout' });
  ioInstance?.to(`user:${id1}`).emit('match_cancelled', { battleId, reason: 'timeout' });

  for (const p of [p0, p1]) {
    const pid = getUserId(p.user);
    if (p.response === 'accepted') {
      await redis.zadd(QUEUE_KEY, p.user?.rating || 1200, pid);
      await redis.hset('matchmaking:times', pid, Date.now());
    } else {
      await redis.set(`cooldown:${pid}`, '1', 'EX', getAcceptWindowSeconds());
    }
  }
};

const acceptMatch = async (battleId, userId) => {
  const battle = await Battle.findById(battleId);
  if (!battle) {
    return { success: false, message: 'Battle not found' };
  }
  const isPart = battle.players.some((p) => getUserId(p.user) === String(userId));
  if (!isPart) {
    return { success: false, message: 'Not a participant in this battle' };
  }
  if (battle.status === 'finished' || battle.status === 'cancelled') {
    return { success: false, message: 'Battle has already ended' };
  }
  if (battle.status !== 'pending') {
    return { success: false, message: 'Battle is not in pending state' };
  }

  const updated = await Battle.findOneAndUpdate(
    { _id: battleId, status: 'pending', 'players.user': userId },
    { $set: { 'players.$.response': 'accepted' } },
    { new: true }
  );
  if (!updated) {
    return { success: false, message: 'Could not accept match' };
  }

  const allAccepted = updated.players.every((p) => p.response === 'accepted');
  if (allAccepted) {
    if (acceptTimers[battleId]) {
      clearTimeout(acceptTimers[battleId]);
      delete acceptTimers[battleId];
    }
    await startBattle(battleId);
  }
  return { success: true, message: 'Match accepted' };
};

const declineMatch = async (battleId, userId) => {
  const battle = await Battle.findById(battleId);
  if (!battle) {
    return { success: false, message: 'Battle not found' };
  }
  const isPart = battle.players.some((p) => getUserId(p.user) === String(userId));
  if (!isPart) {
    return { success: false, message: 'Not a participant in this battle' };
  }
  if (battle.status === 'finished' || battle.status === 'cancelled') {
    return { success: false, message: 'Battle has already ended' };
  }
  if (battle.status !== 'pending') {
    return { success: false, message: 'Battle is not in pending state' };
  }

  if (acceptTimers[battleId]) {
    clearTimeout(acceptTimers[battleId]);
    delete acceptTimers[battleId];
  }

  const updated = await Battle.findOneAndUpdate(
    { _id: battleId, status: 'pending' },
    { status: 'cancelled' },
    { new: true }
  ).populate('players.user');
  if (!updated) {
    return { success: false, message: 'Battle already concluded' };
  }

  const decliner = updated.players.find((p) => getUserId(p.user) === String(userId));
  const accepter = updated.players.find((p) => getUserId(p.user) !== String(userId));

  if (decliner) {
    const declinerId = getUserId(decliner.user);
    ioInstance?.to(`user:${declinerId}`).emit('match_cancelled', { battleId, reason: 'declined' });
    await redis.set(`cooldown:${declinerId}`, '1', 'EX', getAcceptWindowSeconds());
  }
  if (accepter) {
    const accepterId = getUserId(accepter.user);
    ioInstance?.to(`user:${accepterId}`).emit('match_cancelled', { battleId, reason: 'declined' });
    await redis.zadd(QUEUE_KEY, accepter.user?.rating || 1200, accepterId);
    await redis.hset('matchmaking:times', accepterId, Date.now());
  }

  return { success: true, message: 'Match declined' };
};

const startBattle = async (battleId) => {
  const startedAt = new Date();
  const duration = getBattleDurationSeconds();
  const endsAt = new Date(Date.now() + duration * 1000);
  const battle = await Battle.findOneAndUpdate(
    { _id: battleId, status: 'pending' },
    { status: 'active', startedAt, endsAt },
    { new: true }
  ).populate('problem players.user');
  if (!battle) return;

  const problemDoc = await Problem.findById(battle.problem?._id || battle.problem).select('+hiddenTestCases');
  const totalTests = (problemDoc?.sampleTestCases?.length || 0) + (problemDoc?.hiddenTestCases?.length || 0);
  battle.players.forEach((p) => {
    p.totalTests = totalTests;
  });
  await battle.save();

  battleTimers[battle._id] = setTimeout(() => {
    onBattleTimeUp(battle._id);
  }, duration * 1000);

  const cleanProb = cleanProblem(battle.problem);
  const p0 = battle.players[0].user;
  const p1 = battle.players[1].user;

  ioInstance?.to(`user:${p0._id}`).emit('battle_start', {
    battleId: battle._id,
    serverNow: Date.now(),
    startedAt,
    endsAt,
    problem: cleanProb,
    opponent: {
      _id: p1._id,
      username: p1.username,
      avatar: p1.avatar,
      rating: p1.rating,
      tier: getTier(p1.rating),
    },
  });

  ioInstance?.to(`user:${p1._id}`).emit('battle_start', {
    battleId: battle._id,
    serverNow: Date.now(),
    startedAt,
    endsAt,
    problem: cleanProb,
    opponent: {
      _id: p0._id,
      username: p0.username,
      avatar: p0.avatar,
      rating: p0.rating,
      tier: getTier(p0.rating),
    },
  });
};

const onBattleTimeUp = async (battleId) => {
  const battle = await Battle.findById(battleId);
  if (!battle || battle.status !== 'active') return;

  const p0 = battle.players[0];
  const p1 = battle.players[1];
  let winner = null;
  let reason = 'draw';

  if (p0.bestPassed > p1.bestPassed) {
    winner = p0.user;
    reason = 'time';
  } else if (p1.bestPassed > p0.bestPassed) {
    winner = p1.user;
    reason = 'time';
  }

  await finishBattle(battleId, winner, reason);
};

const finishBattle = async (battleId, winnerId, reason) => {
  const battle = await Battle.findOneAndUpdate(
    { _id: battleId, status: 'active' },
    { status: 'finished', winner: winnerId || null, reason },
    { new: true }
  ).populate('players.user problem');
  if (!battle) return;

  if (battleTimers[battle._id]) {
    clearTimeout(battleTimers[battle._id]);
    delete battleTimers[battle._id];
  }

  const p0 = battle.players[0];
  const p1 = battle.players[1];
  const p0Id = getUserId(p0.user);
  const p1Id = getUserId(p1.user);

  if (disconnectTimers[`${battle._id}:${p0Id}`]) {
    clearTimeout(disconnectTimers[`${battle._id}:${p0Id}`]);
    delete disconnectTimers[`${battle._id}:${p0Id}`];
  }
  if (disconnectTimers[`${battle._id}:${p1Id}`]) {
    clearTimeout(disconnectTimers[`${battle._id}:${p1Id}`]);
    delete disconnectTimers[`${battle._id}:${p1Id}`];
  }

  const r0 = p0.ratingBefore;
  const r1 = p1.ratingBefore;

  const exp0 = 1 / (1 + Math.pow(10, (r1 - r0) / 400));
  const exp1 = 1 - exp0;

  let s0 = 0.5;
  let s1 = 0.5;
  if (reason !== 'draw' && winnerId) {
    if (String(winnerId) === p0Id) {
      s0 = 1;
      s1 = 0;
    } else {
      s0 = 0;
      s1 = 1;
    }
  }

  const delta0 = Math.round(32 * (s0 - exp0));
  const delta1 = Math.round(32 * (s1 - exp1));
  const newR0 = Math.max(100, r0 + delta0);
  const newR1 = Math.max(100, r1 + delta1);

  const xp0 = s0 === 1 ? 50 : s0 === 0.5 ? 20 : 10;
  const xp1 = s1 === 1 ? 50 : s1 === 0.5 ? 20 : 10;

  p0.ratingAfter = newR0;
  p0.ratingDelta = delta0;
  p0.xpGained = xp0;

  p1.ratingAfter = newR1;
  p1.ratingDelta = delta1;
  p1.xpGained = xp1;

  const u0 = await User.findById(p0Id);
  if (u0) {
    u0.rating = newR0;
    u0.xp = (u0.xp || 0) + xp0;
    u0.stats.wins = (u0.stats.wins || 0) + (s0 === 1 ? 1 : 0);
    u0.stats.losses = (u0.stats.losses || 0) + (s0 === 0 ? 1 : 0);
    u0.stats.draws = (u0.stats.draws || 0) + (s0 === 0.5 ? 1 : 0);
    u0.stats.streak = s0 === 1 ? (u0.stats.streak || 0) + 1 : s0 === 0 ? 0 : u0.stats.streak || 0;
    u0.stats.peakRating = Math.max(u0.stats.peakRating || 1200, newR0);
    await u0.save();
  }

  const u1 = await User.findById(p1Id);
  if (u1) {
    u1.rating = newR1;
    u1.xp = (u1.xp || 0) + xp1;
    u1.stats.wins = (u1.stats.wins || 0) + (s1 === 1 ? 1 : 0);
    u1.stats.losses = (u1.stats.losses || 0) + (s1 === 0 ? 1 : 0);
    u1.stats.draws = (u1.stats.draws || 0) + (s1 === 0.5 ? 1 : 0);
    u1.stats.streak = s1 === 1 ? (u1.stats.streak || 0) + 1 : s1 === 0 ? 0 : u1.stats.streak || 0;
    u1.stats.peakRating = Math.max(u1.stats.peakRating || 1200, newR1);
    await u1.save();
  }

  await battle.save();

  const payload = formatBattleEndShape(battle);

  ioInstance?.to(`user:${p0Id}`).emit('battle_end', payload);
  ioInstance?.to(`user:${p1Id}`).emit('battle_end', payload);
};

const forfeitBattle = async (battleId, userId) => {
  const battle = await Battle.findById(battleId);
  if (!battle) {
    return { success: false, message: 'Battle not found' };
  }
  const isPart = battle.players.some((p) => getUserId(p.user) === String(userId));
  if (!isPart) {
    return { success: false, message: 'Not a participant in this battle' };
  }
  if (battle.status === 'finished' || battle.status === 'cancelled') {
    return { success: false, message: 'Battle has already ended' };
  }
  if (battle.status !== 'active') {
    return { success: false, message: 'Battle is not active' };
  }

  const opponent = battle.players.find((p) => getUserId(p.user) !== String(userId));
  if (!opponent) {
    return { success: false, message: 'Opponent not found' };
  }

  await finishBattle(battleId, getUserId(opponent.user), 'forfeit');
  return { success: true, message: 'Battle forfeited' };
};

const handleDisconnect = async (userId) => {
  const battle = await Battle.findOne({ 'players.user': userId, status: 'active' });
  if (!battle) return;

  const opponent = battle.players.find((p) => getUserId(p.user) !== String(userId));
  if (!opponent) return;

  const opponentId = getUserId(opponent.user);
  const grace = getReconnectGraceSeconds();
  ioInstance?.to(`user:${opponentId}`).emit('opponent_disconnected', { graceSeconds: grace });

  const timerKey = `${battle._id}:${userId}`;
  if (disconnectTimers[timerKey]) clearTimeout(disconnectTimers[timerKey]);

  disconnectTimers[timerKey] = setTimeout(async () => {
    delete disconnectTimers[timerKey];
    const userConns = parseInt((await redis.get(`user:connections:${userId}`)) || '0', 10);
    if (userConns > 0) return;

    const oppConns = parseInt((await redis.get(`user:connections:${opponentId}`)) || '0', 10);
    if (oppConns <= 0) {
      const updated = await Battle.findOneAndUpdate(
        { _id: battle._id, status: 'active' },
        { status: 'abandoned', reason: null },
        { new: true }
      );
      if (updated) {
        ioInstance?.to(`user:${opponentId}`).emit('battle_end', {
          battleId: battle._id,
          status: 'abandoned',
          winner: null,
          reason: 'abandoned',
          players: [],
          timeline: [],
        });
      }
      return;
    }

    await finishBattle(battle._id, opponentId, 'disconnect');
  }, grace * 1000);
};

const handleReconnect = async (userId) => {
  const battle = await Battle.findOne({ 'players.user': userId, status: 'active' });
  if (!battle) return;

  const timerKey = `${battle._id}:${userId}`;
  if (disconnectTimers[timerKey]) {
    clearTimeout(disconnectTimers[timerKey]);
    delete disconnectTimers[timerKey];
    const opponent = battle.players.find((p) => getUserId(p.user) !== String(userId));
    if (opponent) {
      ioInstance?.to(`user:${getUserId(opponent.user)}`).emit('opponent_reconnected');
    }
  }
};

const getBattleState = async (battleId, userId) => {
  const battle = await Battle.findById(battleId).populate('problem players.user');
  if (!battle) {
    return { success: false, message: 'Battle not found' };
  }
  const isPart = battle.players.some((p) => getUserId(p.user) === String(userId));
  if (!isPart) {
    return { success: false, message: 'Not a participant in this battle' };
  }

  const state = await formatBattleState(battle, userId);
  return { success: true, data: state };
};

const handleChatMessage = async (battleId, userId, text) => {
  const battle = await Battle.findById(battleId);
  if (!battle) {
    return { success: false, message: 'Battle not found' };
  }
  const isPart = battle.players.some((p) => getUserId(p.user) === String(userId));
  if (!isPart) {
    return { success: false, message: 'Not a participant in this battle' };
  }
  if (battle.status === 'finished' || battle.status === 'cancelled') {
    return { success: false, message: 'Battle has already ended' };
  }
  if (battle.status !== 'active' && battle.status !== 'pending') {
    return { success: false, message: 'Battle is not active' };
  }

  const rateKey = `ratelimit:chat:${userId}:${battleId}`;
  const count = await redis.incr(rateKey);
  if (count === 1) {
    await redis.expire(rateKey, 5);
  }
  if (count > 5) {
    return { success: false, message: 'Rate limit exceeded: maximum 5 messages per 5s' };
  }

  const cleanText = String(text || '')
    .replace(/<[^>]*>?/gm, '')
    .trim()
    .slice(0, 200);
  if (!cleanText) {
    return { success: false, message: 'Message text cannot be empty' };
  }

  const user = await User.findById(userId);
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  const msg = {
    from: user.username,
    text: cleanText,
    at: Date.now(),
  };

  const chatKey = `battle:chat:${battleId}`;
  await redis.rpush(chatKey, JSON.stringify(msg));
  await redis.ltrim(chatKey, -50, -1);
  await redis.expire(chatKey, 86400);

  const p0 = getUserId(battle.players[0].user);
  const p1 = getUserId(battle.players[1].user);
  ioInstance?.to(`user:${p0}`).emit('battle_chat_message', msg);
  ioInstance?.to(`user:${p1}`).emit('battle_chat_message', msg);

  return { success: true, message: 'Message sent' };
};

const runMatcherTick = async () => {
  try {
    const times = await redis.hgetall('matchmaking:times');
    const entries = Object.entries(times).sort((a, b) => Number(a[1]) - Number(b[1]));
    if (entries.length < 2) return;

    const matchedSet = new Set();
    const now = Date.now();

    for (let i = 0; i < entries.length; i++) {
      const [uA, tA] = entries[i];
      if (matchedSet.has(uA)) continue;

      const scoreA = await redis.zscore(QUEUE_KEY, uA);
      if (scoreA === null) continue;

      const waitedA = Math.floor((now - Number(tA)) / 1000);
      const gapA = Math.min(600, 100 + 25 * waitedA);

      for (let j = i + 1; j < entries.length; j++) {
        const [uB, tB] = entries[j];
        if (matchedSet.has(uB)) continue;

        const scoreB = await redis.zscore(QUEUE_KEY, uB);
        if (scoreB === null) continue;

        const waitedB = Math.floor((now - Number(tB)) / 1000);
        const gapB = Math.min(600, 100 + 25 * waitedB);

        const diff = Math.abs(Number(scoreA) - Number(scoreB));
        if (diff <= Math.max(gapA, gapB)) {
          const removed = await redis.eval(
            MATCH_LUA,
            2,
            QUEUE_KEY,
            'matchmaking:times',
            uA,
            uB
          );
          if (removed === 1) {
            matchedSet.add(uA);
            matchedSet.add(uB);
            await createMatchedBattle(uA, uB);
            break;
          }
        }
      }
    }
  } catch (err) {
  }
};

const broadcastQueueStatus = async () => {
  try {
    const times = await redis.hgetall('matchmaking:times');
    const userIds = Object.keys(times);
    const playersInQueue = userIds.length;
    const now = Date.now();

    for (const [uid, enterTime] of Object.entries(times)) {
      const waitingSeconds = Math.max(0, Math.floor((now - Number(enterTime)) / 1000));
      ioInstance?.to(`user:${uid}`).emit('queue_status', {
        waitingSeconds,
        playersInQueue,
      });
    }
  } catch (err) {
  }
};

const getArenaStats = async () => {
  const onlineKeys = await redis.keys('user:connections:*');
  const online = onlineKeys.length;
  const inQueue = (await redis.zcard(QUEUE_KEY)) || 0;
  const activeBattles = await Battle.countDocuments({ status: 'active' });
  return {
    online,
    inQueue,
    inBattles: activeBattles * 2,
  };
};

const initBattleEngine = async (io) => {
  setIO(io);

  if (matcherInterval) clearInterval(matcherInterval);
  if (queueStatusInterval) clearInterval(queueStatusInterval);

  matcherInterval = setInterval(runMatcherTick, 1000);
  queueStatusInterval = setInterval(broadcastQueueStatus, 3000);

  const now = Date.now();
  const activeBattles = await Battle.find({ status: 'active' });
  for (const b of activeBattles) {
    const rem = new Date(b.endsAt).getTime() - now;
    if (rem <= 0) {
      await onBattleTimeUp(b._id);
    } else {
      battleTimers[b._id] = setTimeout(() => {
        onBattleTimeUp(b._id);
      }, rem);
    }
  }

  const pendingBattles = await Battle.find({ status: 'pending' });
  for (const pb of pendingBattles) {
    const rem = new Date(pb.acceptDeadline).getTime() - now;
    if (rem <= 0) {
      await onAcceptTimeout(pb._id);
    } else {
      acceptTimers[pb._id] = setTimeout(() => {
        onAcceptTimeout(pb._id);
      }, rem);
    }
  }
};

module.exports = {
  setIO,
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
  finishBattle,
  getArenaStats,
  formatBattleState,
  formatBattleEndShape,
  getUserId,
  toTimeMs,
};
