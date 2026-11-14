const { io } = require('socket.io-client');
const User = require('../src/models/User');
const Battle = require('../src/models/Battle');
const Submission = require('../src/models/Submission');
const redis = require('../src/config/redis');
const connectDB = require('../src/config/db');

const API_URL = process.env.SERVER_URL || 'http://localhost:5000';

const loginOrRegister = async (username, email, password) => {
  const loginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });

  const loginData = await loginRes.json();
  if (loginRes.ok && loginData.data?.accessToken) {
    return { token: loginData.data.accessToken, user: loginData.data.user };
  }

  const regRes = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  const regData = await regRes.json();
  if (regRes.ok && regData.data?.accessToken) {
    return { token: regData.data.accessToken, user: regData.data.user };
  }

  throw new Error(regData.message || loginData.message || 'Auth failed');
};

const connectPlayerSocket = (token) => {
  return new Promise((resolve, reject) => {
    const s = io(API_URL, { auth: { token }, reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
};

const cleanupSimData = async () => {
  await connectDB();
  const users = await User.find({ username: /^sim_/ });
  const userIds = users.map((u) => u._id);
  const userStrIds = users.map((u) => String(u._id));

  if (userIds.length > 0) {
    const subRes = await Submission.deleteMany({ user: { $in: userIds } });
    const batRes = await Battle.deleteMany({ 'players.user': { $in: userIds } });
    const usrRes = await User.deleteMany({ _id: { $in: userIds } });
    console.log(`[SIM-CLEANUP] Deleted ${usrRes.deletedCount} users, ${batRes.deletedCount} battles, ${subRes.deletedCount} submissions.`);
  }

  for (const id of userStrIds) {
    await redis.zrem('matchmaking:queue:ranked_1v1', id);
    await redis.hdel('matchmaking:times', id);
    await redis.del(`cooldown:${id}`);
    await redis.del(`user:connections:${id}`);
    await redis.del(`ratelimit:submission:${id}`);
  }

  const allCooldowns = await redis.keys('cooldown:*');
  for (const k of allCooldowns) {
    await redis.del(k);
  }

  const chatKeys = await redis.keys('battle:chat:*');
  for (const k of chatKeys) {
    await redis.del(k);
  }
  console.log('[SIM-CLEANUP] Redis queues and cooldowns cleared.');
};

const runDoubleSubmitScenario = async () => {
  console.log('\n--- Scenario 1: Double Submit ---');
  const p1 = await loginOrRegister('sim_rival_one', 'sim_one@example.com', 'Pass123456!');
  const p2 = await loginOrRegister('sim_rival_two', 'sim_two@example.com', 'Pass123456!');

  const u1Before = await User.findById(p1.user._id);
  const u2Before = await User.findById(p2.user._id);

  const s1 = await connectPlayerSocket(p1.token);
  const s2 = await connectPlayerSocket(p2.token);

  let s1EndCount = 0;
  let s2EndCount = 0;
  let endPayload = null;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Double-submit timeout')), 20000);

    s1.once('match_found', (data) => {
      s1.emit('match_accept', { battleId: data.battleId });
    });
    s2.once('match_found', (data) => {
      s2.emit('match_accept', { battleId: data.battleId });
    });

    const submitSolution = async (battleId, problem) => {
      const code = problem.starterCode?.javascript || problem.starterCode?.python;
      const lang = problem.starterCode?.javascript ? 'javascript' : 'python';
      await Promise.all([
        fetch(`${API_URL}/api/v1/battles/${battleId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1.token}` },
          body: JSON.stringify({ language: lang, code }),
        }),
        fetch(`${API_URL}/api/v1/battles/${battleId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p2.token}` },
          body: JSON.stringify({ language: lang, code }),
        }),
      ]);
    };

    let started = false;
    const onStart = (data) => {
      if (started) return;
      started = true;
      setTimeout(() => {
        submitSolution(data.battleId, data.problem);
      }, 500);
    };

    s1.once('battle_start', onStart);
    s2.once('battle_start', onStart);

    s1.on('battle_end', (data) => {
      s1EndCount++;
      endPayload = data;
    });

    s2.on('battle_end', () => {
      s2EndCount++;
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 1000);
    });

    s1.emit('queue_join', { mode: 'ranked_1v1' });
    s2.emit('queue_join', { mode: 'ranked_1v1' });
  });

  const battleDoc = await Battle.findById(endPayload.battleId);
  const u1After = await User.findById(p1.user._id);
  const u2After = await User.findById(p2.user._id);

  const passedOnce = s1EndCount === 1 && s2EndCount === 1;
  const singleWinner = battleDoc.status === 'finished' && Boolean(battleDoc.winner);
  const rating1Changed = u1After.rating !== u1Before.rating;
  const rating2Changed = u2After.rating !== u2Before.rating;
  const hasUserIds = endPayload.players.every((p) => typeof p.userId === 'string' && p.userId.length > 0);
  const hasRuntime = endPayload.players.some((p) => typeof p.runtimeMs === 'number');

  s1.disconnect();
  s2.disconnect();

  if (!passedOnce || !singleWinner || !rating1Changed || !rating2Changed || !hasUserIds) {
    throw new Error(`Double-submit assertion failed: s1Ends=${s1EndCount}, s2Ends=${s2EndCount}, winner=${battleDoc.winner}, r1Changed=${rating1Changed}, r2Changed=${rating2Changed}`);
  }

  console.log(`[PASS] Double-submit scenario: S1 ends: ${s1EndCount}, S2 ends: ${s2EndCount}, Winner: ${battleDoc.winner}, R1: ${u1Before.rating}->${u1After.rating}, R2: ${u2Before.rating}->${u2After.rating}, runtimeMs verified: ${hasRuntime}.`);
};

const runDeclineScenario = async () => {
  console.log('\n--- Scenario 2: Decline Match ---');
  const p1 = await loginOrRegister('sim_decline_one', 'sim_dec_one@example.com', 'Pass123456!');
  const p2 = await loginOrRegister('sim_decline_two', 'sim_dec_two@example.com', 'Pass123456!');

  const s1 = await connectPlayerSocket(p1.token);
  const s2 = await connectPlayerSocket(p2.token);

  let s1Cancelled = null;
  let s2Cancelled = null;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Decline scenario timeout')), 15000);

    s1.once('match_found', (data) => {
      s1.emit('match_accept', { battleId: data.battleId });
    });
    s2.once('match_found', (data) => {
      s2.emit('match_decline', { battleId: data.battleId });
    });

    s1.once('match_cancelled', (data) => {
      s1Cancelled = data;
      s1.emit('queue_leave', () => {});
    });

    s2.once('match_cancelled', (data) => {
      s2Cancelled = data;
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 500);
    });

    s1.emit('queue_join', { mode: 'ranked_1v1' });
    s2.emit('queue_join', { mode: 'ranked_1v1' });
  });

  const cooldown = await redis.get(`cooldown:${p2.user._id}`);

  s1.disconnect();
  s2.disconnect();

  await redis.zrem('matchmaking:queue:ranked_1v1', String(p1.user._id), String(p2.user._id));
  await redis.hdel('matchmaking:times', String(p1.user._id), String(p2.user._id));

  if (s1Cancelled?.reason !== 'declined' || s2Cancelled?.reason !== 'declined' || !cooldown) {
    throw new Error('Decline assertion failed');
  }

  console.log('[PASS] Decline scenario: match_cancelled received by both with reason "declined", cooldown key confirmed.');
};

const runForfeitScenario = async () => {
  console.log('\n--- Scenario 3: Forfeit Battle ---');
  const p1 = await loginOrRegister('sim_forfeit_one', 'sim_forf_one@example.com', 'Pass123456!');
  const p2 = await loginOrRegister('sim_forfeit_two', 'sim_forf_two@example.com', 'Pass123456!');

  const s1 = await connectPlayerSocket(p1.token);
  const s2 = await connectPlayerSocket(p2.token);

  let endData = null;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Forfeit scenario timeout')), 15000);

    s1.once('match_found', (data) => {
      s1.emit('match_accept', { battleId: data.battleId });
    });
    s2.once('match_found', (data) => {
      s2.emit('match_accept', { battleId: data.battleId });
    });

    s1.once('battle_start', (data) => {
      setTimeout(() => {
        s1.emit('battle_forfeit', { battleId: data.battleId });
      }, 500);
    });

    s2.once('battle_end', (data) => {
      endData = data;
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 500);
    });

    s1.emit('queue_join', { mode: 'ranked_1v1' });
    s2.emit('queue_join', { mode: 'ranked_1v1' });
  });

  s1.disconnect();
  s2.disconnect();

  await redis.zrem('matchmaking:queue:ranked_1v1', String(p1.user._id), String(p2.user._id));
  await redis.hdel('matchmaking:times', String(p1.user._id), String(p2.user._id));

  if (endData?.reason !== 'forfeit' || endData?.winner !== String(p2.user._id)) {
    throw new Error(`Forfeit assertion failed: reason=${endData?.reason}, winner=${endData?.winner}`);
  }

  console.log(`[PASS] Forfeit scenario: Battle ended with reason "forfeit", winner correctly set to opponent (${p2.user.username}).`);
};

const run = async () => {
  await connectDB();

  if (process.argv.includes('--cleanup')) {
    await cleanupSimData();
    process.exit(0);
  }

  await cleanupSimData();
  await runDoubleSubmitScenario();
  await runDeclineScenario();
  await runForfeitScenario();

  console.log('\n[SIM] All simulation scenarios completed successfully.');
  process.exit(0);
};

run().catch((err) => {
  console.error('[SIM] Error:', err);
  process.exit(1);
});
