require('dotenv').config({ path: `${__dirname}/../.env`, quiet: true });
process.env.JWT_ACCESS_SECRET ||= 'codingarena-matchmaking-simulator';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const http = require('node:http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io: connect } = require('socket.io-client');
const User = require('../src/models/User');
const Problem = require('../src/models/Problem');
const Battle = require('../src/models/Battle');
const redis = require('../src/config/redis');
const { initSocket } = require('../src/sockets');

const namespace = `matchmaking_sim_${randomUUID().replaceAll('-', '')}`;
const queueKey = 'matchmaking:queue:ranked_1v1';
redis.options.keyPrefix = `${namespace}:`;
const clients = [];
let server;
let io;

const event = async (socket, name) => (await once(socket, name, { signal: AbortSignal.timeout(10000) }))[0];
const ack = (socket, name, data = {}) => new Promise((resolve, reject) => {
  socket.timeout(10000).emit(name, data, (error, result) => error ? reject(error) : resolve(result));
});
const joinBoth = async () => {
  const results = await Promise.all(clients.map((socket) => ack(socket, 'queue_join')));
  results.forEach((result) => assert.equal(result.success, true, result.message));
};
const assertQueueEmpty = async () => {
  assert.equal(await redis.zcard(queueKey), 0);
  assert.deepEqual(await redis.hgetall('matchmaking:times'), {});
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codingarena', {
    dbName: namespace,
    serverSelectionTimeoutMS: 5000,
  });
  await redis.ping();
  server = http.createServer();
  io = initSocket(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const users = await User.create([
    { username: 'match_player_a', email: 'a@example.com' },
    { username: 'match_player_b', email: 'b@example.com' },
  ]);
  for (const user of users) {
    const token = jwt.sign({ userId: String(user._id) }, process.env.JWT_ACCESS_SECRET);
    const socket = connect(url, { auth: { token }, reconnection: false });
    clients.push(socket);
    await event(socket, 'connect');
  }

  for (const socket of clients) {
    const result = await ack(socket, 'queue_join');
    assert.equal(result.success, false);
    assert.match(result.message, /no coding problems/i);
  }
  await assertQueueEmpty();
  console.log('PASS empty database: both players receive a clear rejection, neither is queued');

  // Reproduce players already queued before the problem library became empty.
  const missingProblems = clients.map((socket) => event(socket, 'queue_error'));
  for (const user of users) {
    await redis.zadd(queueKey, user.rating, String(user._id));
    await redis.hset('matchmaking:times', String(user._id), Date.now());
  }
  for (const result of await Promise.all(missingProblems)) assert.match(result.message, /no coding problems/i);
  await assertQueueEmpty();
  assert.equal(await Battle.countDocuments(), 0);
  console.log('PASS existing queue without problems: both players notified instead of silently dropped');

  const problem = await Problem.create({
    title: 'Matchmaking test', slug: 'matchmaking-test', description: 'Print the input.', difficulty: 'easy',
    sampleTestCases: [{ input: '1', expectedOutput: '1' }],
    hiddenTestCases: [{ input: '2', expectedOutput: '2' }],
  });

  const originalCreate = Battle.create;
  const originalError = console.error;
  const loggedErrors = [];
  try {
    Battle.create = async () => { throw new Error('Simulated database write failure'); };
    console.error = (...args) => loggedErrors.push(args);
    const failedMatches = clients.map((socket) => event(socket, 'queue_error'));
    await joinBoth();
    for (const result of await Promise.all(failedMatches)) assert.match(result.message, /could not create your match/i);
    await assertQueueEmpty();
    assert.equal(await Battle.countDocuments(), 0);
    assert(loggedErrors.some(([message]) => message === 'Match creation failed:'));
  } finally {
    Battle.create = originalCreate;
    console.error = originalError;
  }
  console.log('PASS database write failure: both players notified, error logged, queue can be joined again');

  const found = clients.map((socket) => event(socket, 'match_found'));
  await joinBoth();
  const matches = await Promise.all(found);
  assert.equal(matches[0].battleId, matches[1].battleId);
  assert.equal(matches[0].opponent.username, users[1].username);
  assert.equal(matches[1].opponent.username, users[0].username);
  assert.equal(matches[0].problem.title, problem.title);
  assert.equal(await Battle.countDocuments({ status: 'pending' }), 1);
  await assertQueueEmpty();

  const started = clients.map((socket) => event(socket, 'battle_start'));
  for (const socket of clients) {
    const result = await ack(socket, 'match_accept', { battleId: matches[0].battleId });
    assert.equal(result.success, true, result.message);
  }
  for (const battle of await Promise.all(started)) {
    assert.equal(battle.battleId, matches[0].battleId);
    assert.equal(battle.problem.slug, problem.slug);
    assert.equal('hiddenTestCases' in battle.problem, false);
  }
  const battle = await Battle.findById(matches[0].battleId);
  assert.equal(battle.status, 'active');
  assert(battle.players.every((player) => player.totalTests === 2));
  await Battle.updateOne({ _id: battle._id }, { status: 'cancelled' });
  console.log('PASS two-account duel: same match, correct opponents, both accept, active battle with private tests');
};

run().catch((error) => {
  console.error('FAIL matchmaking:', error);
  process.exitCode = 1;
}).finally(async () => {
  clients.forEach((socket) => socket.disconnect());
  io?.close();
  server?.close();
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === namespace) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    if (redis.status === 'ready') {
      const keys = await redis.keys(`${namespace}:*`);
      assert(keys.every((key) => key.startsWith(`${namespace}:`)));
      if (keys.length) await redis.del(...keys.map((key) => key.slice(namespace.length + 1)));
    }
  } catch (error) {
    console.error('Simulator cleanup failed:', error);
    process.exitCode = 1;
  }
  redis.disconnect();
  process.exit(process.exitCode || 0);
});
