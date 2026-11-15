require('dotenv').config({ path: `${__dirname}/../.env` });
process.env.LLM_MOCK = 'true';
process.env.BATTLE_DURATION_SECONDS = '60';
process.env.AFTER_FIRST_FINISH_SECONDS = '60';
process.env.INTERVIEW_QUESTIONS = '2';
process.env.INTERVIEW_QUESTION_SECONDS = '4';
process.env.INTERVIEW_READ_ALLOWANCE_SECONDS = '0';
process.env.INTERVIEW_MAX_SECONDS = '24';
process.env.RECONNECT_GRACE_SECONDS = '1';
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
const Interview = require('../src/models/Interview');
const llmService = require('../src/services/llmService');
const originalLLM = llmService.callLLM;
let failCode = null;
llmService.callLLM = (args) => args.purpose === 'interview_score' && JSON.parse(args.user).code === failCode ? Promise.resolve('invalid scoring JSON') : originalLLM(args);
const analysisService = require('../src/services/analysisService');
const originalAnalysis = analysisService.analyzeSolution;
let analysisCalls = 0;
analysisService.analyzeSolution = (args) => { analysisCalls++; return originalAnalysis(args); };
const { initSocket } = require('../src/sockets');
const { submitBattleCode, getBattleById, getActiveBattle } = require('../src/controllers/battleController');
const { finishBattle, initBattleEngine } = require('../src/services/battleService');
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
  const complete = [0, 0];
  const questions = [[], []];
  const phases = [[], []];
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
    socket.on('interview_complete', () => { complete[index]++; });
    socket.on('interview_started', (data) => questions[index].push(data.question));
    socket.on('interview_question', (data) => questions[index].push(data));
    socket.on('opponent_phase', (data) => phases[index].push(data));
    clients.push(socket);
  }
  const battle = await Battle.create({ players: users.map((user) => ({ user, ratingBefore: 1200, totalTests: 3, response: 'accepted' })), problem: problem._id, status: 'active', startedAt: new Date(), endsAt: new Date(Date.now() + 60000), battleDurationMs: 60000 });
  return { battle, users, clients, tokens, events, finalizing, complete, questions, phases, analysesBefore: analysisCalls, expectedCodes: [code, code + '\n'] };
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
  requirePass(ctx.events[0][0].players.every((p) => typeof p.scores?.total === 'number' && p.phase === 'done'), 'Missing scores or done phase');
  ctx.events.forEach((events, index) => {
    const own = events[0].players[index];
    const opponent = events[0].players[1 - index];
    requirePass(Array.isArray(own.interview?.perQuestion) && own.interview.feedback, 'Own interview detail missing');
    requirePass(!('perQuestion' in opponent.interview) && !('feedback' in opponent.interview) && !('myCode' in opponent), 'Opponent transcript leaked');
    requirePass(events[0].myCode?.code === ctx.expectedCodes[index], 'Own evaluated code missing');
    requirePass(!JSON.stringify(opponent).includes('Walk me through'), 'Opponent question leaked');
  });
  requirePass(analysisCalls === ctx.analysesBefore + 2, 'Stored analysis was rerun during finalization');
  requirePass(!('myTests' in ctx.events[0][0].players[1]) && !('myTests' in ctx.events[1][0].players[0]), 'Opponent tests leaked');
  ctx.clients.forEach((socket) => socket.disconnect());
};

const draftAndFinish = async (ctx, index) => {
  const draft = await ack(ctx.clients[index], 'code_draft', { battleId: String(ctx.battle._id), language: 'javascript', code: index ? code + '\n' : code });
  requirePass(draft.success, draft.message);
  const finish = await ack(ctx.clients[index], 'battle_finish', { battleId: String(ctx.battle._id) });
  requirePass(finish.success, finish.message);
};

const joinInterview = (ctx, index) => ack(ctx.clients[index], 'interview_join', { battleId: String(ctx.battle._id) });
const currentQuestion = async (ctx, index) => {
  let state;
  await waitFor(() => ctx.questions[index].length > 0);
  const until = Date.now() + 25000;
  do {
    state = await joinInterview(ctx, index);
    if (state.question) return state;
    if (['done', 'skipped', 'failed'].includes(state.status)) return state;
    await delay(30);
  } while (Date.now() < until);
  throw new Error('No interview question');
};

const answerAll = async (ctx, index, skipFirst = false) => {
  let last = -1;
  while (true) {
    const state = await currentQuestion(ctx, index);
    if (['done', 'skipped', 'failed'].includes(state.status)) return;
    if (!state.question || state.question.index === last) { await delay(30); continue; }
    if (last >= 0) await delay(2050);
    const result = await ack(ctx.clients[index], 'interview_answer', { battleId: String(ctx.battle._id), questionIndex: state.question.index, text: 'I store previously seen values in a map and check the complement once for each value. Time and space grow linearly with the input.', inputMode: index ? 'voice' : 'typed', skip: skipFirst && state.question.index === 0 });
    requirePass(result.success, result.message);
    last = state.question.index;
    if (last === state.total - 1) {
      await waitFor(() => ctx.complete[index] > 0);
      return;
    }
  }
};

const ratingsOnce = async (ctx) => {
  for (const id of ctx.users) {
    const user = await User.collection.findOne({ _id: id });
    requirePass(user.stats.wins + user.stats.losses + user.stats.draws === 1 && user.appliedBattleResults.length === 1, 'Ratings applied more than once');
    const result = ctx.events[0][0].players.find((player) => player.userId === String(id));
    requirePass(user.xp === result.xpGained && user.rating === result.ratingAfter, 'Rating or XP mismatch');
  }
};

const scenarios = async () => {
  let ctx = await makeBattle();
  await Promise.all([submit(ctx, 0), submit(ctx, 1, code + '\n')]);
  await Promise.all([currentQuestion(ctx, 0), currentQuestion(ctx, 1)]);
  let battle = await Battle.findById(ctx.battle._id);
  requirePass(!battle.winner && battle.status === 'active' && !ctx.events[0].length, 'Winner decided before interviews');
  await Promise.all([answerAll(ctx, 0), answerAll(ctx, 1)]);
  await completed(ctx);
  requirePass(ctx.events[0][0].players.every((p) => p.scores.interview === 80 && p.interview.score === 80), 'Interview formula incorrect');
  const details = await fetch(`${base}/battles/${ctx.battle._id}`, { headers: { Authorization: `Bearer ${ctx.tokens[0]}` } }).then((res) => res.json());
  requirePass(details.data.myCode.code === code && details.data.players[0].interview.perQuestion.length === 2 && !('perQuestion' in details.data.players[1].interview), 'GET privacy or transcript mismatch');
  const perspectives = ctx.events.map((events) => events[0]);
  for (const payload of [...perspectives, details.data]) {
    requirePass(payload.headToHead.total === 1, 'Head-to-head excludes current battle');
    requirePass(Math.abs(Object.values(payload.scoring.activeWeights).reduce((sum, value) => sum + value, 0) - 100) < 0.001, 'Active weights do not sum to 100');
    for (const player of payload.players) {
      requirePass(player.record && ['rating', 'rank', 'wins', 'losses', 'draws', 'matches', 'winRate', 'streak', 'peakRating'].every((key) => Number.isFinite(player.record[key])) && typeof player.record.tier === 'string', 'Missing record snapshot');
      requirePass(player.record.matches === 1 && !player.record.isCurrent, 'Record is not a final snapshot');
      requirePass(Math.abs(Object.values(player.points).reduce((sum, value) => sum + value, 0) - player.scores.total) < 0.1, 'Points do not sum to total');
      requirePass(['runtimeMs', 'passedCount', 'totalTests', 'solveTimeMs'].every((key) => Number.isFinite(player[key])), 'Missing numeric evaluation metrics');
      requirePass(['score', 'understanding', 'answered', 'total'].every((key) => Number.isFinite(player.interview[key])), 'Missing numeric interview metrics');
      requirePass(typeof player.timeComplexity === 'string' && typeof player.spaceComplexity === 'string' && Object.values(player.quality).every(Number.isFinite), 'Missing analysis metrics');
    }
  }
  requirePass(perspectives[0].headToHead.wins === perspectives[1].headToHead.losses && perspectives[0].headToHead.losses === perspectives[1].headToHead.wins && perspectives[0].headToHead.draws === perspectives[1].headToHead.draws, 'Head-to-head perspectives do not mirror');
  requirePass(JSON.stringify(perspectives[0].players.map((player) => player.record)) === JSON.stringify(details.data.players.map((player) => player.record)), 'GET changed saved snapshots');
  console.log('PASS result-comparison: both records, current battle in head-to-head, mirrored perspectives, points equal totals, numeric metrics, private GET payloads');
  console.log('PASS interview-flow: both answered, interview scores 80/80, winner after both, one battle_end per player, private GET payloads');

  ctx = await makeBattle();
  await Promise.all([draftAndFinish(ctx, 0), draftAndFinish(ctx, 1)]);
  const grounded = await currentQuestion(ctx, 0);
  requirePass(/map/i.test(grounded.question.text) && !/line \d|`|walk me through/i.test(grounded.question.text), 'Question was not a plain-language implementation question');
  await Promise.all([answerAll(ctx, 0, true), answerAll(ctx, 1)]);
  await completed(ctx);
  const skippedInterview = await Interview.findOne({ battle: ctx.battle._id, user: ctx.users[0] });
  requirePass(skippedInterview.questions[0].status === 'skipped' && skippedInterview.questions[0].accuracy === 0 && skippedInterview.score === 40, 'Skip did not reduce interview score proportionally');
  const skipResults = ctx.events[0][0].players;
  requirePass(skipResults[0].scores.interview === 40 && skipResults[1].scores.interview === 80 && skipResults[0].scores.total < skipResults[1].scores.total, 'Skip did not reduce overall score');
  console.log('PASS code-specific-skip: grounded question, skipped status, interview 40/80, overall score reduced');


  ctx = await makeBattle();
  await draftAndFinish(ctx, 0);
  await answerAll(ctx, 0);
  battle = await Battle.findById(ctx.battle._id);
  requirePass(ctx.complete[0] && !ctx.events[0].length && battle.players[0].phase === 'done' && battle.players[1].phase === 'coding', 'First finisher did not wait');
  const state = await ack(ctx.clients[0], 'battle_join', { battleId: String(ctx.battle._id) });
  requirePass(state.data.myPhase === 'done' && state.data.opponentPhase === 'coding', 'Phase resync mismatch');
  const active = await fetch(`${base}/battles/active`, { headers: { Authorization: `Bearer ${ctx.tokens[0]}` } }).then((res) => res.json());
  requirePass(active.data.battle.myPhase === 'done' && active.data.battle.opponentPhase === 'coding', 'Active API phase mismatch');
  await draftAndFinish(ctx, 1);
  await answerAll(ctx, 1);
  await completed(ctx);
  console.log('PASS first-finisher-waits: interview_complete while opponent still codes, no early battle_end, phase resync works');

  ctx = await makeBattle();
  await Promise.all([draftAndFinish(ctx, 0), draftAndFinish(ctx, 1)]);
  await answerAll(ctx, 0);
  await completed(ctx);
  requirePass(ctx.events[0][0].players[1].scores.interview === 0, 'Unanswered interview was not zero');
  const timedOut = await Interview.findOne({ battle: ctx.battle._id, user: ctx.users[1] });
  requirePass(timedOut.questions.length === 2 && timedOut.questions.every((q) => q.status === 'expired'), 'Questions did not expire');
  console.log('PASS interview-timeout: both unanswered questions expired, interview score 0, battle finished');

  ctx = await makeBattle();
  await draftAndFinish(ctx, 0);
  const before = await currentQuestion(ctx, 0);
  await delay(200);
  const resumed = await joinInterview(ctx, 0);
  requirePass(resumed.question.index === before.question.index && resumed.question.text === before.question.text && String(resumed.deadlineAt) === String(before.deadlineAt) && resumed.serverNow > before.serverNow && resumed.finalCode === code, 'Resume changed question or deadline');
  const forbidden = await ack(ctx.clients[1], 'interview_join', { battleId: String(ctx.battle._id) });
  requirePass(!forbidden.success && !forbidden.finalCode, 'Coding opponent could access interview');
  await answerAll(ctx, 0);
  await draftAndFinish(ctx, 1);
  await answerAll(ctx, 1);
  await completed(ctx);
  console.log('PASS resume: same question and deadline, remaining time decreased, own final code only');

  ctx = await makeBattle();
  await Promise.all([draftAndFinish(ctx, 0), draftAndFinish(ctx, 1)]);
  const question = await currentQuestion(ctx, 0);
  const payload = { battleId: String(ctx.battle._id), questionIndex: question.question.index, text: 'I keep a map of values and inspect each input once.', inputMode: 'typed' };
  requirePass((await ack(ctx.clients[0], 'interview_answer', payload)).success, 'First answer failed');
  const duplicate = await ack(ctx.clients[0], 'interview_answer', { ...payload, text: 'Changed duplicate' });
  requirePass(duplicate.success && /duplicate/i.test(duplicate.message), 'Duplicate not ignored');
  const saved = await Interview.findOne({ battle: ctx.battle._id, user: ctx.users[0] });
  requirePass(saved.questions[0].answer === payload.text, 'Duplicate changed answer');
  await waitFor(() => ctx.questions[0].some((q) => q.index === 1));
  await delay(2050);
  requirePass((await ack(ctx.clients[0], 'interview_answer', { ...payload, questionIndex: 1 })).success, 'Second answer failed');
  const lateQuestion = await currentQuestion(ctx, 1);
  await delay(Math.max(0, new Date(lateQuestion.deadlineAt).getTime() - Date.now() + 50));
  const late = await ack(ctx.clients[1], 'interview_answer', { ...payload, questionIndex: lateQuestion.question.index });
  requirePass(!late.success && /deadline/i.test(late.message), 'Late answer accepted');
  await completed(ctx);
  console.log('PASS duplicate-answer: ignored without changing stored answer');
  console.log('PASS late-answer: rejected after deadline with ack message');

  ctx = await makeBattle();
  failCode = code + '\n';
  await Promise.all([draftAndFinish(ctx, 0), draftAndFinish(ctx, 1)]);
  await Promise.all([answerAll(ctx, 0), answerAll(ctx, 1)]);
  await completed(ctx);
  requirePass(ctx.events[0][0].players.every((p) => p.scores.interview === null && p.interview.score === null), 'Interview failure not symmetric');
  requirePass((await Interview.findOne({ battle: ctx.battle._id, user: ctx.users[1] })).status === 'failed', 'Failed scoring status missing');
  failCode = null;
  console.log('PASS llm-failure: one player scoring failed, interview null for both, battle finished');

  ctx = await makeBattle();
  await Promise.all([draftAndFinish(ctx, 0), draftAndFinish(ctx, 1)]);
  const locked = await ack(ctx.clients[0], 'battle_finish', { battleId: String(ctx.battle._id) });
  requirePass(!locked.success && !ctx.events[0].length, 'Double finish bypassed interview');
  await Promise.all([answerAll(ctx, 0), answerAll(ctx, 1)]);
  await Promise.all([finishBattle(ctx.battle._id), finishBattle(ctx.battle._id)]);
  await completed(ctx);
  await ratingsOnce(ctx);
  console.log('PASS double-finish: one finalization, one battle_end per player, ratings and XP applied once');

  ctx = await makeBattle();
  await Promise.all([draftAndFinish(ctx, 0), draftAndFinish(ctx, 1)]);
  const disconnectedState = await currentQuestion(ctx, 1);
  ctx.clients[1].disconnect();
  await delay(1300);
  battle = await Battle.findById(ctx.battle._id);
  requirePass(battle.status === 'active' && battle.players[1].phase === 'interview' && !ctx.events[0].length, 'Interview disconnect forfeited');
  const socket = ctx.clients[1];
  socket.connect();
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  const reconnected = await joinInterview(ctx, 1);
  requirePass(String(reconnected.deadlineAt) === String(disconnectedState.deadlineAt) && reconnected.serverNow > disconnectedState.serverNow, 'Disconnect paused interview clock');
  await Promise.all([answerAll(ctx, 0), answerAll(ctx, 1)]);
  await completed(ctx);
  console.log('PASS disconnect-during-interview: no forfeit after coding grace, same deadline, clock continued');

  ctx = await makeBattle();
  process.env.AFTER_FIRST_FINISH_SECONDS = '1';
  requirePass((await ack(ctx.clients[1], 'code_draft', { battleId: String(ctx.battle._id), language: 'javascript', code: code + '\n' })).success, 'Timeout draft save failed');
  await submit(ctx, 0);
  await currentQuestion(ctx, 1);
  battle = await Battle.findById(ctx.battle._id);
  requirePass(battle.status === 'active' && battle.players[1].finishedBy === 'timeout' && !ctx.events[0].length, 'Coding timeout ended match');
  await Promise.all([answerAll(ctx, 0), answerAll(ctx, 1)]);
  await completed(ctx);
  process.env.AFTER_FIRST_FINISH_SECONDS = '60';
  console.log('PASS coding-deadline: shortened deadline auto-evaluated draft and started interview without deciding winner');

  ctx = await makeBattle();
  ctx.expectedCodes[1] = '';
  await draftAndFinish(ctx, 0);
  requirePass((await ack(ctx.clients[1], 'battle_finish', { battleId: String(ctx.battle._id) })).success, 'No-code finish failed');
  await answerAll(ctx, 0);
  await completed(ctx);
  const skipped = await Interview.findOne({ battle: ctx.battle._id, user: ctx.users[1] });
  requirePass(skipped.status === 'skipped' && skipped.score === 0 && skipped.questions.length === 0 && ctx.events[0][0].players[1].scores.interview === 0, 'No-code interview was not skipped');
  console.log('PASS no-code-skip: no questions, status skipped, interview score 0');

  ctx = await makeBattle();
  await Promise.all([draftAndFinish(ctx, 0), draftAndFinish(ctx, 1)]);
  const original = await currentQuestion(ctx, 0);
  await currentQuestion(ctx, 1);
  await initBattleEngine(io);
  const recovered = await joinInterview(ctx, 0);
  requirePass(recovered.question.text === original.question.text && String(recovered.deadlineAt) === String(original.deadlineAt), 'Boot changed open interview');
  await Promise.all([answerAll(ctx, 0), answerAll(ctx, 1)]);
  await completed(ctx);
  console.log('PASS restart-recovery: open question and deadlines preserved, stored analysis reused');

  ctx = await makeBattle();
  await Promise.all([draftAndFinish(ctx, 0), draftAndFinish(ctx, 1)]);
  await Promise.all([currentQuestion(ctx, 0), currentQuestion(ctx, 1)]);
  await Battle.updateOne({ _id: ctx.battle._id }, { $set: { status: 'finalizing' } });
  await initBattleEngine(io);
  await completed(ctx);
  await ratingsOnce(ctx);
  console.log('PASS stuck-finalizing: boot completed saved results without rerunning analysis, ratings and XP once');

  ctx = await makeBattle();
  await Promise.all([draftAndFinish(ctx, 0), draftAndFinish(ctx, 1)]);
  await Promise.all([currentQuestion(ctx, 0), currentQuestion(ctx, 1)]);
  const oldCodingEnd = new Date(Date.now() - (Number(process.env.INTERVIEW_MAX_SECONDS) + 31) * 1000);
  await Battle.updateOne({ _id: ctx.battle._id }, { $set: { 'players.0.finishedAt': oldCodingEnd, 'players.1.finishedAt': oldCodingEnd } });
  await initBattleEngine(io);
  await completed(ctx);
  console.log('PASS hard-cap: overdue coding-end cap closed stuck interviews and finalized using saved results');

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
  app.get('/battles/active', getActiveBattle);
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
