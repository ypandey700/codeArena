require('dotenv').config({ path: `${__dirname}/../.env`, quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Battle = require('../src/models/Battle');
const Problem = require('../src/models/Problem');
const Interview = require('../src/models/Interview');
const redis = require('../src/config/redis');
const { setIO, acceptMatch, getBattleState, forfeitBattle } = require('../src/services/battleService');

const namespace = `surrender_sim_${randomUUID().replaceAll('-', '')}`;
redis.options.keyPrefix = `${namespace}:`;
const events = [];
setIO({ to: (room) => ({ emit: (name, payload) => events.push({ room, name, payload }) }) });
let problem;
let outsider;
let sequence = 0;

async function scenario(phase, ratings = [1200, 1200], expectedLoss = 16) {
  const users = await User.create(ratings.map((rating) => {
    const username = `surrender_${++sequence}`;
    return { username, email: `${username}@example.com`, rating };
  }));
  const battle = await Battle.create({
    problem: problem._id, status: 'pending', acceptDeadline: new Date(Date.now() + 60000),
    players: users.map((user) => ({ user: user._id, ratingBefore: user.rating })),
  });
  for (const user of users) assert.equal((await acceptMatch(battle._id, user._id)).success, true);
  const start = events.find((event) => event.name === 'battle_start' && String(event.payload.battleId) === String(battle._id) && event.room === `user:${users[0]._id}`);
  assert.equal(start.payload.forfeitRatingLoss, expectedLoss, 'fresh duel warning has the correct penalty');
  if (phase !== 'coding') {
    await Battle.updateOne({ _id: battle._id }, { $set: { 'players.0.phase': phase === 'setup' ? 'interview' : phase } });
    await Interview.create({ battle: battle._id, user: users[0]._id, status: phase === 'setup' ? 'pending' : phase === 'done' ? 'done' : 'active', startedAt: new Date(), deadlineAt: new Date(Date.now() + 60000), total: 1, questions: phase === 'interview' ? [{ index: 0, text: 'Explain your code.', status: 'open' }] : [] });
  }
  const state = await getBattleState(battle._id, users[0]._id);
  assert.equal(state.data.forfeitRatingLoss, expectedLoss, 'resumed duel warning matches the start payload');
  assert.equal((await forfeitBattle(battle._id, outsider._id)).success, false, 'nonparticipants cannot surrender');
  assert.equal((await Battle.findById(battle._id)).status, 'active', 'viewing a warning does not end the duel');

  const outcomes = await Promise.all([forfeitBattle(battle._id, users[0]._id), forfeitBattle(battle._id, users[0]._id)]);
  assert(outcomes.some((outcome) => outcome.success));
  const saved = await Battle.findById(battle._id);
  assert.equal(saved.status, 'finished');
  assert.equal(saved.reason, 'forfeit');
  assert.equal(String(saved.winner), String(users[1]._id));
  assert(saved.players.every((player) => player.phase === 'done'));
  const current = await User.collection.findOne({ _id: users[0]._id });
  assert.equal(users[0].rating - current.rating, expectedLoss, 'deducted points match the warning, including the rating floor');
  assert.equal(current.stats.losses, 1);
  assert.equal(current.appliedBattleResults.filter((id) => id === String(battle._id)).length, 1);
  assert.equal((await User.findById(users[1]._id)).stats.wins, 1);
  assert.equal(await Interview.countDocuments({ battle: battle._id, status: { $in: ['pending', 'active'] } }), 0, 'outstanding interviews are cancelled');
  const results = events.filter((event) => event.name === 'battle_end' && event.payload.battleId === String(battle._id));
  assert.equal(results.length, 2, 'each participant receives one result');
  assert.equal((await forfeitBattle(battle._id, users[0]._id)).success, false, 'a completed duel cannot be surrendered again');
  assert.equal((await User.findById(users[0]._id)).stats.losses, 1);
  console.log(`PASS surrender from ${phase} (${ratings.join(' vs ')}): warning matches ${expectedLoss}-point deduction, opponent wins, one result each`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codingarena', { dbName: namespace, serverSelectionTimeoutMS: 5000 });
  problem = await Problem.create({ title: 'Surrender test', slug: 'surrender-test', description: 'Print the result.', difficulty: 'easy' });
  outsider = await User.create({ username: 'outsider', email: 'outsider@example.com' });
  await scenario('coding');
  await scenario('setup');
  await scenario('interview', [1600, 1200], 29);
  await scenario('done');
  await scenario('coding', [105, 105], 5);
  await scenario('interview', [100, 100], 0);
}

run().catch((error) => { console.error('FAIL surrender:', error); process.exitCode = 1; }).finally(async () => {
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
