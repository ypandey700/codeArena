require('dotenv').config({ path: `${__dirname}/../.env` });
process.env.LLM_MOCK = 'true';
process.env.BATTLE_DURATION_SECONDS = '20';
process.env.AFTER_FIRST_FINISH_SECONDS = '2';
process.env.JWT_ACCESS_SECRET ||= 'codingarena-local-simulator';

const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const { io: connect } = require('socket.io-client');
const Battle = require('../src/models/Battle');
const Problem = require('../src/models/Problem');
const User = require('../src/models/User');
const redis = require('../src/config/redis');
const analysisService = require('../src/services/analysisService');
const originalAnalysis = analysisService.analyzeSolution;
let failCode = null;
analysisService.analyzeSolution = (args) => args.code === failCode ? Promise.resolve(null) : originalAnalysis(args);
const { initSocket } = require('../src/sockets');
const { submitBattleCode, getBattleById } = require('../src/controllers/battleController');
const { finishBattle } = require('../src/services/battleService');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const code = "const t=require('fs').readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);const n=t[0],target=t[1],seen=new Map();for(let i=0;i<n;i++){let x=t[i+2];if(seen.has(target-x)){console.log(seen.get(target-x),i);break;}seen.set(x,i);}";
let server;
let io;
let base;
let problem;
let sequence = 0;
const sockets = [];
const requirePass = (value, message) => { if (!value) throw new Error(message); };
const ack = (socket, event, data) => new Promise((resolve, reject) => socket.timeout(20000).emit(event, data, (err, result) => err ? reject(err) : resolve(result)));
const waitFor = async (predicate, ms = 25000) => {
  const until = Date.now() + ms;
  while (!predicate()) {
    if (Date.now() >= until) throw new Error('Scenario timed out');
    await delay(50);
  }
};

const makeBattle = async () => {
  const users = [];
  const clients = [];
  const tokens = [];
  const events = [[], []];
  const finalizing = [0, 0];
  for (let index = 0; index < 2; index++) {
    const _id = new mongoose.Types.ObjectId();
    const username = `sim_${++sequence}`;
    await User.collection.insertOne({ _id, username, email: `${username}@example.com`, rating: 1200, xp: 0, stats: { wins: 0, losses: 0, draws: 0, streak: 0, peakRating: 1200 } });
    users.push(_id);
    const token = jwt.sign({ userId: String(_id) }, process.env.JWT_ACCESS_SECRET);
    tokens.push(token);
    const socket = connect(base, { auth: { token }, reconnection: false });
    sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    socket.on('battle_end', (payload) => events[index].push(payload));
    socket.on('battle_finalizing', () => { finalizing[index]++; });
    clients.push(socket);
  }
  const battle = await Battle.create({ players: users.map((user) => ({ user, ratingBefore: 1200, totalTests: 3, response: 'accepted' })), problem: problem._id, status: 'active', startedAt: new Date(), endsAt: new Date(Date.now() + 20000), battleDurationMs: 20000 });
  return { battle, users, clients, tokens, events, finalizing };
};

const submit = async (ctx, index, source = code) => {
  const response = await fetch(`${base}/battles/${ctx.battle._id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.tokens[index]}` }, body: JSON.stringify({ language: 'javascript', code: source }) });
  const body = await response.json();
  requirePass(response.ok && body.success, body.message || 'Submission failed');
  requirePass(body.data.status === 'accepted', `Runner failed: ${JSON.stringify(body)}`);
};

const completed = async (ctx) => {
  await waitFor(() => ctx.events[0].length && ctx.events[1].length);
  await delay(200);
  requirePass(ctx.events.every((events) => events.length === 1), 'Duplicate battle_end');
  requirePass(ctx.finalizing.every((count) => count === 1), 'Duplicate finalization');
  requirePass(ctx.events[0][0].players.every((p) => typeof p.scores?.total === 'number' && p.scores.interview === null), 'Missing scores');
  requirePass(!('myTests' in ctx.events[0][0].players[1]) && !('myTests' in ctx.events[1][0].players[0]), 'Opponent tests leaked');
  ctx.clients.forEach((socket) => socket.disconnect());
};

const scenarios = async () => {
  let ctx = await makeBattle();
  await submit(ctx, 0);
  requirePass(ctx.events[0].length === 0, 'First finisher ended battle');
  const locked = await ack(ctx.clients[0], 'battle_finish', { battleId: String(ctx.battle._id) });
  requirePass(!locked.success, 'Finished player was not locked');
  await submit(ctx, 1);
  await completed(ctx);
  console.log('PASS first-finisher: both solved, one battle_end per player, scores present');

  ctx = await makeBattle();
  const draft = await ack(ctx.clients[1], 'code_draft', { battleId: String(ctx.battle._id), language: 'javascript', code });
  requirePass(draft.success, draft.message);
  await submit(ctx, 0);
  const shortened = await Battle.findById(ctx.battle._id);
  requirePass(new Date(shortened.endsAt) - Date.now() <= 2100, 'Deadline not shortened');
  await completed(ctx);
  const own = ctx.events[1][0].players[1];
  requirePass(own.resultSource === 'auto_draft' && own.myTests.length === 3, 'Draft not evaluated');
  requirePass(!('input' in own.myTests[2]) && !('expected' in own.myTests[2]) && !('actual' in own.myTests[2]), 'Hidden test leaked');
  const details = await fetch(`${base}/battles/${ctx.battle._id}`, { headers: { Authorization: `Bearer ${ctx.tokens[1]}` } }).then((res) => res.json());
  requirePass(details.data.players[1].myTests.length === 3 && !('myTests' in details.data.players[0]), 'GET privacy mismatch');
  console.log('PASS draft-autoeval: shortened deadline, auto_draft, own tests, hidden data redacted');

  ctx = await makeBattle();
  await Promise.all(ctx.clients.map((socket) => ack(socket, 'code_draft', { battleId: String(ctx.battle._id), language: 'javascript', code }).then((result) => requirePass(result.success, result.message))));
  const finishes = await Promise.all(ctx.clients.map((socket) => ack(socket, 'battle_finish', { battleId: String(ctx.battle._id) })));
  requirePass(finishes.every((result) => result.success), 'Double finish failed');
  await Promise.all([finishBattle(ctx.battle._id), finishBattle(ctx.battle._id)]);
  await completed(ctx);
  for (const id of ctx.users) {
    const user = await User.collection.findOne({ _id: id });
    requirePass(user.stats.wins + user.stats.losses + user.stats.draws === 1, 'Ratings or stats applied more than once');
    requirePass(user.appliedBattleResults.length === 1, 'Duplicate rating marker');
    const result = ctx.events[0][0].players.find((player) => player.userId === String(id));
    requirePass(user.xp === result.xpGained && user.rating === result.ratingAfter, 'Rating or XP mismatch');
  }
  console.log('PASS double-finish: one finalization, one battle_end per player, ratings and XP once');

  ctx = await makeBattle();
  failCode = `${code}\n`;
  await Promise.all([submit(ctx, 0), submit(ctx, 1, failCode)]);
  await completed(ctx);
  requirePass(ctx.events[0][0].players.every((p) => ['timeComplexity', 'spaceComplexity', 'quality', 'interview'].every((key) => p.scores[key] === null)), 'Unavailable components not null for both');
  failCode = null;
  console.log('PASS analysis-failure: one player analysis failed, both analysis components null, battle finished');
};

const run = async () => {
  const uri = new URL(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codingarena');
  uri.pathname = `/codingarena_sim_${Date.now()}`;
  redis.options.keyPrefix = `sim:${Date.now()}:`;
  await mongoose.connect(uri.toString(), { serverSelectionTimeoutMS: 5000 });
  problem = await Problem.create({ title: 'Two Sum', slug: 'two-sum', description: 'Print indices of two values summing to target.', difficulty: 'easy', optimalTime: 'O(n)', optimalSpace: 'O(n)', timeLimitMs: 2000, sampleTestCases: [{ input: '4 9\n2 7 11 15\n', expectedOutput: '0 1' }, { input: '3 6\n3 2 4\n', expectedOutput: '1 2' }], hiddenTestCases: [{ input: '2 6\n3 3\n', expectedOutput: '0 1' }] });
  const app = express();
  app.use(express.json());
  app.use(async (req, res, next) => {
    try { req.user = await User.findById(jwt.verify(req.headers.authorization?.slice(7), process.env.JWT_ACCESS_SECRET).userId); next(); } catch { res.status(401).json({ message: 'Unauthorized' }); }
  });
  app.post('/battles/:id/submit', submitBattleCode);
  app.get('/battles/:id', getBattleById);
  server = http.createServer(app);
  io = initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  await scenarios();
};

run().then(() => console.log('PASS all battle scenarios')).catch((err) => { console.error(`FAIL ${err.message}`); process.exitCode = 1; }).finally(async () => {
  sockets.forEach((socket) => socket.disconnect());
  io?.close();
  server?.close();
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (redis.status === 'ready') {
    const keys = await redis.keys('*');
    for (const key of keys) await redis.del(key.slice(redis.options.keyPrefix.length));
  }
  await redis.quit();
  process.exit(process.exitCode || 0);
});
