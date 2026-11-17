require('dotenv').config({ path: `${__dirname}/../.env`, quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Battle = require('../src/models/Battle');
const Problem = require('../src/models/Problem');
const Interview = require('../src/models/Interview');
const redis = require('../src/config/redis');
const { setIO, finishBattle } = require('../src/services/battleService');

const namespace = `finalization_sim_${randomUUID().replaceAll('-', '')}`;
redis.options.keyPrefix = `${namespace}:`;
const events = [];
setIO({ to: (room) => ({ emit: (name, payload) => { if (name === 'battle_end') events.push({ room, payload }); } }) });
let problem;
let sequence = 0;

async function fixture() {
  const users = await User.create([0, 1].map(() => {
    const username = `finalizer_${++sequence}`;
    return { username, email: `${username}@example.com` };
  }));
  const startedAt = new Date(Date.now() - 60000);
  const battle = await Battle.create({
    problem: problem._id, status: 'active', startedAt, endsAt: new Date(Date.now() + 60000), battleDurationMs: 120000,
    players: users.map((user, index) => ({ user: user._id, ratingBefore: 1200, phase: 'done', response: 'accepted', finishedAt: new Date(), codingProcessedAt: new Date(), bestPassed: index ? 1 : 2, totalTests: 2, solvedAt: index ? null : new Date(startedAt.getTime() + 30000), runtimeMs: 5, finalCode: 'print(1)', language: 'python' })),
  });
  await Interview.create(users.map((user, index) => ({ battle: battle._id, user: user._id, status: 'done', startedAt, deadlineAt: new Date(), total: 1, score: index ? 40 : 80, questions: [{ index: 0, text: 'Explain your solution.', answer: 'I inspect the input once.', status: 'answered', accuracy: 8, depth: 8, clarity: 8 }] })));
  return { battle, users };
}

async function verify({ battle, users }) {
  const saved = await Battle.findById(battle._id);
  assert.equal(saved.status, 'finished');
  for (const user of users) {
    const player = saved.players.find((item) => String(item.user) === String(user._id));
    const current = await User.collection.findOne({ _id: user._id });
    assert.equal(current.rating, player.ratingAfter);
    assert.equal(current.xp, player.xpGained);
    assert.equal(current.stats.wins + current.stats.losses + current.stats.draws, 1);
    assert.equal(current.appliedBattleResults.filter((id) => id === String(battle._id)).length, 1);
    assert.equal(player.record.matches, 1);
    assert.equal(player.record.rating, current.rating);
  }
  const published = events.filter(({ payload }) => String(payload.battleId) === String(battle._id));
  assert.equal(published.length, 2);
  assert.equal(new Set(published.map(({ room }) => room)).size, 2);
  assert(published.every(({ payload }) => payload.status === 'finished'));
}

async function interrupted(stage, transactional) {
  const ctx = await fixture();
  const originalUserUpdate = User.collection.updateOne;
  const originalBattleUpdate = Battle.updateOne;
  const originalError = console.error;
  let failed = false;
  try {
    console.error = () => {};
    if (stage === 'second player') {
      User.collection.updateOne = function (filter, ...args) {
        if (!failed && String(filter._id) === String(ctx.users[1]._id)) { failed = true; throw new Error('Simulated second-player write failure'); }
        return originalUserUpdate.call(this, filter, ...args);
      };
    } else {
      Battle.updateOne = function (filter, update, ...args) {
        if (!failed && update.$set?.status === 'finished') { failed = true; throw new Error('Simulated final-result write failure'); }
        return originalBattleUpdate.call(this, filter, update, ...args);
      };
    }
    await assert.rejects(finishBattle(ctx.battle._id), /Simulated/);
  } finally {
    User.collection.updateOne = originalUserUpdate;
    Battle.updateOne = originalBattleUpdate;
    console.error = originalError;
  }
  assert(failed);
  assert.equal((await Battle.findById(ctx.battle._id)).status, 'finalizing');
  assert.equal(events.filter(({ payload }) => String(payload.battleId) === String(ctx.battle._id)).length, 0);
  const changed = await User.collection.countDocuments({ _id: { $in: ctx.users.map((user) => user._id) }, appliedBattleResults: String(ctx.battle._id) });
  assert.equal(changed, transactional ? 0 : stage === 'second player' ? 1 : 2);
  await finishBattle(ctx.battle._id, null, 'time', true);
  await verify(ctx);
  console.log(`PASS recovery after ${stage} failure: one rating/XP award per player, one final event each`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codingarena', { dbName: namespace, serverSelectionTimeoutMS: 5000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const transactional = Boolean(hello.setName || hello.msg === 'isdbgrid');
  console.log(`Testing ${transactional ? 'transaction-capable MongoDB' : 'standalone MongoDB'}`);
  problem = await Problem.create({ title: 'Finalization test', slug: 'finalization-test', description: 'Print the result.', difficulty: 'easy', timeLimitMs: 2000 });
  const ctx = await fixture();
  await finishBattle(ctx.battle._id);
  await finishBattle(ctx.battle._id, null, 'time', true);
  await verify(ctx);
  console.log('PASS completed interviews finalize and duplicate recovery does not reapply results');
  await interrupted('second player', transactional);
  await interrupted('final result', transactional);
  const concurrent = await fixture();
  await Battle.updateOne({ _id: concurrent.battle._id }, { status: 'finalizing' });
  await Promise.all([finishBattle(concurrent.battle._id, null, 'time', true), finishBattle(concurrent.battle._id, null, 'time', true)]);
  await verify(concurrent);
  console.log('PASS concurrent recovery: one result publication and one update per player');
}

run().catch((error) => { console.error('FAIL finalization:', error); process.exitCode = 1; }).finally(async () => {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === namespace) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (redis.status === 'ready') {
      const keys = await redis.keys(`${namespace}:*`);
      assert(keys.every((key) => key.startsWith(`${namespace}:`)));
      if (keys.length) await redis.del(...keys.map((key) => key.slice(namespace.length + 1)));
    }
  } catch (error) { console.error('Simulator cleanup failed:', error); process.exitCode = 1; }
  redis.disconnect();
  process.exit(process.exitCode || 0);
});
