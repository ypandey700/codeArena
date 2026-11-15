const Battle = require('../models/Battle');
const Problem = require('../models/Problem');
const Submission = require('../models/Submission');
const User = require('../models/User');
const redis = require('../config/redis');
const { runSubmission } = require('./codeRunnerService');
const { analyzeSolution } = require('./analysisService');
const { computeResult } = require('../config/scoring');
const Interview = require('../models/Interview');
const interviewService = require('./interviewService');
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
const hardTimers = {};
const playerJobs = new Map();

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
  delete p.stressTest;
  return p;
};

const setIO = (io) => {
  ioInstance = io;
  interviewService.configure(io, playerDone);
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
      phase: p.phase || 'coding',
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
      myPhase: me?.phase || 'coding',
      opponentPhase: opp?.phase || 'coding',
      ownFinished: !!me?.finishedAt,
      opponentFinished: !!opp?.finishedAt,
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
    myPhase: me?.phase || 'coding',
    opponentPhase: opp?.phase || 'coding',
    ownFinished: !!me?.finishedAt,
    opponentFinished: !!opp?.finishedAt,
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

const formatBattleEndShape = async (battle, userId) => {
  const interviews = await Interview.find({ battle: battle._id });
  const me = battle.players.find((player) => getUserId(player.user) === String(userId));
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
    phase: player?.phase || 'coding',
    interview: (() => {
      const interview = interviews.find((record) => getUserId(record.user) === getUserId(player.user));
      if (!interview) return null;
      const own = getUserId(player.user) === String(userId);
      const { status, ...numbers } = interviewService.summary(interview);
      return { ...numbers, score: player.scores ? player.scores.interview : numbers.score, ...(own ? { perQuestion: interview.questions.map((q) => ({ question: q.text, answer: q.answer, status: q.status, accuracy: q.accuracy, depth: q.depth, clarity: q.clarity })), feedback: interview.feedback } : {}) };
    })(),
    scores: player?.scores || null,
    timeComplexity: player?.analysis?.timeComplexity || null,
    spaceComplexity: player?.analysis?.spaceComplexity || null,
    quality: player?.analysis?.quality || null,
    finishedBy: player?.finishedBy || null,
    resultSource: player?.resultSource || 'none',
    ...(getUserId(player?.user) === String(userId) ? { myTests: player.myTests || [], feedback: player.analysis?.feedback || [] } : {}),
  });

  return {
    battleId: String(battle._id),
    status: battle.status,
    ...(me && me.finalCode !== undefined ? { myCode: { language: me.language || '', code: me.finalCode || '' } } : {}),
    winner: battle.winner ? String(battle.winner) : null,
    reason: battle.reason || null,
    problem: battle.problem && typeof battle.problem === 'object' ? {
      title: battle.problem.title,
      slug: battle.problem.slug,
      difficulty: battle.problem.difficulty,
      category: battle.problem.category,
      optimalTime: battle.problem.optimalTime || null,
      optimalSpace: battle.problem.optimalSpace || null,
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
    status: { $in: ['pending', 'active', 'finalizing'] },
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
    { status: 'active', startedAt, endsAt, battleDurationMs: duration * 1000 },
    { new: true }
  ).populate('problem players.user');
  if (!battle) return;

  const problemDoc = await Problem.findById(battle.problem?._id || battle.problem).select('+hiddenTestCases');
  const totalTests = (problemDoc?.sampleTestCases?.length || 0) + (problemDoc?.hiddenTestCases?.length || 0);
  battle.players.forEach((p) => {
    p.totalTests = totalTests;
  });
  await battle.save();

  armBattleTimer(battle);

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

const armBattleTimer = (battle) => {
  clearTimeout(battleTimers[battle._id]);
  battleTimers[battle._id] = setTimeout(() => {
    onBattleTimeUp(battle._id).catch(() => {});
  }, Math.max(0, new Date(battle.endsAt).getTime() - Date.now()));
};

const bounded = async (promise, milliseconds) => {
  let timer;
  try { return await Promise.race([promise.catch(() => null), new Promise((resolve) => { timer = setTimeout(() => resolve(null), Math.max(1, milliseconds)); })]); }
  finally { clearTimeout(timer); }
};

const playerDone = async (battleId, userId, interview) => {
  const battle = await Battle.findOneAndUpdate({ _id: battleId, status: 'active', players: { $elemMatch: { user: userId, phase: { $in: ['interview', 'done'] } } } }, { $set: { 'players.$.phase': 'done', 'players.$.interview': interview } }, { new: true });
  if (battle?.players.every((player) => player.phase === 'done' && player.codingProcessedAt)) await finishBattle(battleId);
};

const armHardCap = (battle) => {
  if (!battle.players.every((player) => player.finishedAt)) return;
  clearTimeout(hardTimers[battle._id]);
  const laterEnd = Math.max(...battle.players.map((player) => new Date(player.finishedAt).getTime()));
  const deadline = laterEnd + (interviewService.maxSeconds() + 30) * 1000;
  hardTimers[battle._id] = setTimeout(() => closeAtHardCap(battle._id).catch(() => {}), Math.max(0, deadline - Date.now()));
};

const closeAtHardCap = async (battleId) => {
  const battle = await Battle.findOne({ _id: battleId, status: 'active' }).select('+players.finalCode');
  if (!battle || !battle.players.every((player) => player.finishedAt)) return;
  for (const player of battle.players) {
    await interviewService.ensureInterview(battleId, player);
    if (!player.codingProcessedAt) await Battle.updateOne({ _id: battleId, status: 'active', players: { $elemMatch: { user: player.user, codingProcessedAt: null } } }, { $set: { 'players.$.codingProcessedAt': new Date(), 'players.$.analysisCompletedAt': new Date(), 'players.$.analysis': null, ...(!player.evaluationReady ? { 'players.$.bestPassed': 0, 'players.$.runtimeMs': 0, 'players.$.myTests': [], 'players.$.solvedAt': null } : {}) } });
  }
  await interviewService.forceClose(battleId);
  await finishBattle(battleId);
};

const processPlayer = (battleId, userId) => {
  const key = `${battleId}:${userId}`;
  if (playerJobs.has(key)) return playerJobs.get(key);
  const job = (async () => {
    let battle = await Battle.findOne({ _id: battleId, status: 'active' }).select('+players.finalCode');
    let player = battle?.players.find((p) => getUserId(p.user) === String(userId));
    if (!player || player.phase === 'coding') return;
    const interview = await interviewService.ensureInterview(battleId, player);
    const update = async (values) => Battle.updateOne({ _id: battleId, status: 'active', players: { $elemMatch: { user: userId, phase: { $in: ['interview', 'done'] }, codingProcessedAt: null } } }, { $set: values });
    if (!player.codingProcessedAt) {
      const problem = await Problem.findById(battle.problem).select('+hiddenTestCases');
      if (!player.evaluationReady) {
        const budget = new Date(interview.deadlineAt).getTime() + 20000 - Date.now();
        const evaluated = await bounded(evaluateCode(problem, player.language, player.finalCode), budget) || await evaluateCode(problem, '', '');
        const solved = evaluated.result.status === 'accepted';
        await update({ 'players.$.bestPassed': evaluated.result.passedCount, 'players.$.totalTests': evaluated.result.totalCount, 'players.$.runtimeMs': evaluated.runtimeMs, 'players.$.myTests': evaluated.myTests, 'players.$.evaluationReady': true, 'players.$.solvedAt': solved ? player.finishedAt : null });
      }
      battle = await Battle.findOne({ _id: battleId, status: 'active' }).select('+players.finalCode');
      player = battle?.players.find((p) => getUserId(p.user) === String(userId));
      if (!player || player.codingProcessedAt) return;
      const opponent = battle.players.find((p) => getUserId(p.user) !== String(userId));
      const payload = { endsAt: battle.endsAt, serverNow: Date.now(), passedCount: player.bestPassed, totalCount: player.totalTests };
      ioInstance?.to(`user:${userId}`).emit('you_finished', payload);
      ioInstance?.to(`user:${getUserId(opponent.user)}`).emit('opponent_finished', { ...payload, solveTimeMs: player.solvedAt ? new Date(player.solvedAt) - new Date(battle.startedAt) : null });
      if (!player.analysisCompletedAt) {
        const budget = Math.min((Number(process.env.LLM_TIMEOUT_MS) || 20000) + 5000, new Date(interview.deadlineAt).getTime() + 20000 - Date.now());
        const analysis = await bounded(analyzeSolution({ problem, language: player.language, code: player.finalCode }), budget);
        await update({ 'players.$.analysis': analysis, 'players.$.analysisCompletedAt': new Date() });
      }
      await update({ 'players.$.codingProcessedAt': new Date(), 'players.$.finishing': false });
    }
    await interviewService.start(interview._id);
    await finishBattle(battleId);
  })().finally(() => playerJobs.delete(key));
  playerJobs.set(key, job);
  return job;
};

const endCoding = async (battleId, userId, reason, evaluated = false) => {
  const battle = await Battle.findOne({ _id: battleId, status: 'active' }).select('+players.finalCode');
  const player = battle?.players.find((p) => getUserId(p.user) === String(userId));
  if (!player || player.phase !== 'coding') return { success: false, message: 'Coding is locked' };
  const raw = evaluated ? null : await redis.get(`draft:${battleId}:${userId}`);
  const draft = raw ? JSON.parse(raw) : null;
  const source = draft && draft.at > (toTimeMs(player.codeUpdatedAt) || 0) ? draft : { code: player.finalCode || '', language: player.language };
  const finishedAt = reason === 'timeout' ? new Date(battle.endsAt) : new Date();
  const updated = await Battle.findOneAndUpdate({ _id: battleId, status: 'active', players: { $elemMatch: { user: userId, phase: 'coding', ...(reason === 'locked' ? { finishing: { $ne: true } } : {}) } } }, { $set: { battleDurationMs: battle.battleDurationMs || new Date(battle.endsAt) - new Date(battle.startedAt), 'players.$.phase': 'interview', 'players.$.finishedAt': finishedAt, 'players.$.finishedBy': reason, 'players.$.finishing': false, 'players.$.finalCode': source.code, 'players.$.language': source.language, 'players.$.evaluationReady': evaluated, 'players.$.resultSource': source.code ? (evaluated ? 'submit' : 'auto_draft') : 'none' }, $min: { endsAt: new Date(Date.now() + (Number(process.env.AFTER_FIRST_FINISH_SECONDS) || 180) * 1000) } }, { new: true }).select('+players.finalCode');
  if (!updated) return { success: false, message: 'Coding is locked' };
  const current = updated.players.find((p) => getUserId(p.user) === String(userId));
  const interview = await interviewService.ensureInterview(battleId, current);
  const opponent = updated.players.find((p) => getUserId(p.user) !== String(userId));
  ioInstance?.to(`user:${getUserId(opponent.user)}`).emit('opponent_phase', { phase: 'interview', total: interview.total });
  ioInstance?.to(`user:${userId}`).emit('interview_thinking', {});
  const key = `${battleId}:${userId}`;
  clearTimeout(disconnectTimers[key]);
  delete disconnectTimers[key];
  if (updated.players.some((p) => p.phase === 'coding')) armBattleTimer(updated);
  else { clearTimeout(battleTimers[battleId]); delete battleTimers[battleId]; }
  armHardCap(updated);
  processPlayer(battleId, userId).catch(() => {});
  return { success: true, message: 'Coding locked; interview is starting' };
};

const onBattleTimeUp = async (battleId) => {
  const battle = await Battle.findOne({ _id: battleId, status: 'active' });
  if (!battle) return;
  await Promise.allSettled(battle.players.filter((p) => p.phase === 'coding').map((p) => endCoding(battleId, getUserId(p.user), 'timeout')));
};

const saveDraft = async (battleId, userId, language, code) => {
  if (!['javascript', 'python', 'cpp', 'java'].includes(language) || typeof code !== 'string' || code.length > 20000) {
    return { success: false, message: 'Invalid language or code (maximum 20000 characters)' };
  }
  const battle = await Battle.findById(battleId);
  const player = battle?.players.find((p) => getUserId(p.user) === String(userId));
  if (!player) return { success: false, message: 'Not a participant' };
  if (battle.status !== 'active' || player.phase !== 'coding' || player.finishing || Date.now() >= new Date(battle.endsAt).getTime()) return { success: false, message: 'Coding is locked or time expired' };
  const allowed = await redis.set(`ratelimit:draft:${userId}`, '1', 'EX', 2, 'NX');
  if (!allowed) return { success: false, message: 'Maximum one draft per 2 seconds' };
  await redis.set(`draft:${battleId}:${userId}`, JSON.stringify({ language, code, at: Date.now() }), 'EX', 3600);
  if (!await Battle.exists({ _id: battleId, status: 'active', players: { $elemMatch: { user: userId, phase: 'coding' } } })) return { success: false, message: 'Coding is locked' };
  return { success: true, message: 'Draft saved' };
};

const evaluateCode = async (problem, language, code) => {
  const tests = [...(problem.sampleTestCases || []), ...(problem.hiddenTestCases || [])];
  const result = code ? await runSubmission({ language, code, testCases: tests, timeLimitMs: problem.timeLimitMs, memoryLimitMb: problem.memoryLimitMb }) : { passedCount: 0, totalCount: tests.length, status: 'no_code', testResults: [] };
  const myTests = tests.map((test, index) => {
    const row = result.testResults?.[index];
    const status = row?.status || (row?.passed ? 'accepted' : result.status === 'accepted' ? 'wrong_answer' : result.status);
    return { index, passed: !!row?.passed, status, timeMs: row?.timeMs || 0, ...((row?.error || result.error) ? { error: String(row?.error || result.error).slice(0, 500) } : {}), ...(index < problem.sampleTestCases.length ? { input: test.input, expected: test.expectedOutput, actual: row?.output || '' } : {}) };
  });
  return { result, myTests, runtimeMs: myTests.reduce((sum, test) => sum + test.timeMs, 0) };
};

const finishPlayer = async (battleId, userId, submission) => {
  const battle = await Battle.findById(battleId);
  const player = battle?.players.find((p) => getUserId(p.user) === String(userId));
  if (!player) return { success: false, message: 'Not a participant' };
  if (battle.status !== 'active' || player.phase !== 'coding' || player.finishing || Date.now() >= new Date(battle.endsAt).getTime()) return { success: false, message: 'Coding is locked or time expired' };
  if (!submission) return endCoding(battleId, userId, 'locked');
  const { language, code } = submission;
  if (typeof code !== 'string' || code.length > 20000 || !['javascript', 'python', 'cpp', 'java'].includes(language)) return { success: false, message: 'Invalid language or code' };
  const claimed = await Battle.findOneAndUpdate({ _id: battleId, status: 'active', endsAt: { $gt: new Date() }, players: { $elemMatch: { user: userId, phase: 'coding', finishing: { $ne: true } } } }, { $set: { 'players.$.finishing': true, 'players.$.finalCode': code, 'players.$.language': language, 'players.$.codeUpdatedAt': new Date() } });
  if (!claimed) return { success: false, message: 'Coding is locked' };
  try {
    const problem = await Problem.findById(battle.problem).select('+hiddenTestCases');
    const { result, myTests, runtimeMs } = await evaluateCode(problem, language, code);
    await Submission.create({ user: userId, problem: problem._id, battle: battleId, language, code, status: result.status, error: result.error || '', testResults: myTests.map((test) => ({ passed: test.passed, timeMs: test.timeMs, output: test.actual || '', expected: test.expected || '' })), passedCount: result.passedCount, totalCount: result.totalCount, executionTimeMs: runtimeMs });
    const now = new Date();
    const solved = result.totalCount > 0 && result.passedCount === result.totalCount && result.status === 'accepted';
    const fresh = await Battle.findOneAndUpdate({ _id: battleId, status: 'active', endsAt: { $gt: now }, players: { $elemMatch: { user: userId, phase: 'coding', finishing: true } } }, { $set: { 'players.$.finishing': solved, 'players.$.bestPassed': result.passedCount, 'players.$.totalTests': result.totalCount, 'players.$.runtimeMs': runtimeMs, 'players.$.myTests': myTests, 'players.$.solvedAt': solved ? now : null, 'players.$.lastSubmissionAt': now, 'players.$.resultSource': 'submit' }, $push: { timeline: { user: userId, passedCount: result.passedCount, totalCount: result.totalCount, at: now } } }, { new: true });
    if (!fresh) { onBattleTimeUp(battleId).catch(() => {}); return { success: false, message: 'Coding deadline reached' }; }
    const progress = { status: result.status, passedCount: result.passedCount, totalCount: result.totalCount, timeMs: runtimeMs };
    ioInstance?.to(`user:${userId}`).emit('submission_result', progress);
    if (solved) await endCoding(battleId, userId, 'solved', true);
    else {
      const opponent = fresh.players.find((p) => getUserId(p.user) !== String(userId));
      ioInstance?.to(`user:${getUserId(opponent.user)}`).emit('opponent_progress', { passedCount: result.passedCount, totalCount: result.totalCount, at: now });
    }
    return { success: true, message: solved ? 'Coding locked; interview is starting' : 'Submission evaluated', data: progress };
  } catch (err) {
    await Battle.updateOne({ _id: battleId, status: 'active', players: { $elemMatch: { user: userId, phase: 'coding' } } }, { $set: { 'players.$.finishing': false } });
    throw err;
  }
};

const finishBattle = async (battleId, winnerId, reason = 'time', recover = false) => {
  const battle = await Battle.findOneAndUpdate(
    { _id: battleId, status: recover ? 'finalizing' : 'active', ...(!recover && !['forfeit', 'disconnect'].includes(reason) ? { players: { $not: { $elemMatch: { $or: [{ phase: { $ne: 'done' } }, { codingProcessedAt: null }] } } } } : {}) },
    { status: 'finalizing', ...(recover ? {} : { winner: winnerId || null, reason }) },
    { new: true }
  ).select('+players.finalCode +players.myTests').populate('players.user problem');
  if (!battle) return;
  winnerId = battle.winner;
  reason = battle.reason;
  for (const player of battle.players) ioInstance?.to(`user:${getUserId(player.user)}`).emit('battle_finalizing', {});
  const forced = reason === 'forfeit' || reason === 'disconnect';
  clearTimeout(hardTimers[battleId]);
  delete hardTimers[battleId];
  if (forced || recover) await interviewService.cancelBattle(battleId);
  if (!recover || !battle.players.every((player) => player.ratingAfter != null)) {
    const interviews = await Interview.find({ battle: battleId });
    for (const player of battle.players) {
      const record = interviews.find((item) => getUserId(item.user) === getUserId(player.user));
      player.interview = record ? interviewService.summary(record) : { status: 'failed', score: null };
      player.phase = 'done';
      player.finishing = false;
      if (!player.finishedAt) { player.finishedAt = new Date(); player.finishedBy = 'forfeit'; }
    }
    const computed = computeResult(battle);
    battle.players.forEach((player, index) => { player.scores = computed.scores[index]; });
    if (!forced) {
      winnerId = computed.winner;
      reason = computed.reason;
      battle.winner = winnerId;
      battle.reason = reason;
    }
    await battle.save();
  }

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

  await battle.save();
  for (const [player, score, rating, xp] of [[p0, s0, newR0, xp0], [p1, s1, newR1, xp1]]) {
    const battleKey = String(battle._id);
    const add = (field, amount) => ({ $add: [{ $ifNull: [`$${field}`, 0] }, amount] });
    await User.collection.updateOne({ _id: player.user._id, appliedBattleResults: { $ne: battleKey } }, [{ $set: {
      rating,
      xp: add('xp', xp),
      'stats.wins': add('stats.wins', score === 1 ? 1 : 0),
      'stats.losses': add('stats.losses', score === 0 ? 1 : 0),
      'stats.draws': add('stats.draws', score === 0.5 ? 1 : 0),
      'stats.streak': score === 1 ? add('stats.streak', 1) : score === 0 ? 0 : { $ifNull: ['$stats.streak', 0] },
      'stats.peakRating': { $max: [{ $ifNull: ['$stats.peakRating', 1200] }, rating] },
      appliedBattleResults: { $concatArrays: [{ $ifNull: ['$appliedBattleResults', []] }, [battleKey]] },
    } }]);
  }
  battle.status = 'finished';
  await battle.save();
  ioInstance?.to(`user:${p0Id}`).emit('battle_end', await formatBattleEndShape(battle, p0Id));
  ioInstance?.to(`user:${p1Id}`).emit('battle_end', await formatBattleEndShape(battle, p1Id));
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
  if (!battle || battle.players.find((p) => getUserId(p.user) === String(userId))?.phase !== 'coding') return;

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

    const current = await Battle.findOne({ _id: battle._id, status: 'active' });
    if (!current || current.players.find((p) => getUserId(p.user) === String(userId))?.phase !== 'coding') return;
    const oppConns = parseInt((await redis.get(`user:connections:${opponentId}`)) || '0', 10);
    if (oppConns <= 0 && current.players.every((p) => p.phase === 'coding')) {
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
  const stuck = await Battle.find({ status: 'finalizing' });
  for (const battle of stuck) await finishBattle(battle._id, null, 'time', true);
  await Battle.updateMany({ status: 'active' }, { $set: { 'players.$[].finishing': false } });
  const activeBattles = await Battle.find({ status: 'active' }).select('+players.finalCode');
  for (const battle of activeBattles) {
    for (const player of battle.players) {
      if (player.finishedAt && player.phase === 'coding') {
        await Battle.updateOne({ _id: battle._id, 'players.user': player.user }, { $set: { 'players.$.phase': 'interview' } });
        player.phase = 'interview';
      }
      if (player.phase !== 'coding') {
        const interview = await interviewService.ensureInterview(battle._id, player);
        if (['done', 'failed', 'skipped'].includes(interview.status)) await interviewService.notifyDone(interview);
        if (!player.codingProcessedAt) processPlayer(battle._id, getUserId(player.user)).catch(() => {});
      }
    }
    const current = await Battle.findOne({ _id: battle._id, status: 'active' });
    if (!current) continue;
    armHardCap(current);
    if (current.players.some((player) => player.phase === 'coding')) {
      if (new Date(current.endsAt).getTime() <= now) await onBattleTimeUp(current._id);
      else armBattleTimer(current);
    }
    await finishBattle(current._id);
  }
  await interviewService.restore();

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
  finishPlayer,
  saveDraft,
  getArenaStats,
  formatBattleState,
  formatBattleEndShape,
  getUserId,
  toTimeMs,
};
