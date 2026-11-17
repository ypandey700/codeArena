const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { SkillerProblem, SkillerProfile, SkillerAttempt } = require('./models');
const { TOPICS, DIAGNOSTIC, PROBLEMS } = require('./curriculum');
const { topicMap, recommend } = require('./mastery');
const { parseProfile, importPublicTopics } = require('./profiles');
const { runSubmission } = require('../services/codeRunnerService');
const LEASE_MS = 120000;
const error = (status, message) => Object.assign(new Error(message), { status });
let bankReady;

async function ensureBank() {
  if (!bankReady) bankReady = (async () => {
    await Promise.all([SkillerProblem.init(), SkillerProfile.init(), SkillerAttempt.init()]);
    await SkillerProblem.bulkWrite(PROBLEMS.map((problem) => ({ updateOne: { filter: { slug: problem.slug }, update: { $setOnInsert: problem }, upsert: true } })));
  })().catch((failure) => { bankReady = null; throw failure; });
  return bankReady;
}
async function profileFor(user) {
  try { return await SkillerProfile.findOneAndUpdate({ user }, { $setOnInsert: { user } }, { upsert: true, new: true, setDefaultsOnInsert: true }); }
  catch (failure) { if (failure.code === 11000) return SkillerProfile.findOne({ user }); throw failure; }
}
const historyFields = 'problem topic difficulty kind state active runs submissions hintsUsed result.status result.passedCount result.totalCount startedAt completedAt elapsedMs acceptedAt createdAt updatedAt interview.feedback';
async function historyFor(user) { return SkillerAttempt.find({ user }).select(historyFields).populate('problem', 'title slug').sort({ createdAt: -1 }).lean(); }

const attemptSummary = (attempt) => ({ id: String(attempt._id), title: attempt.problem?.title || 'Practice problem', topic: attempt.topic, difficulty: attempt.difficulty, state: attempt.state, status: attempt.result?.status || null, submissions: attempt.submissions, startedAt: attempt.startedAt, completedAt: attempt.completedAt, elapsedMs: attempt.elapsedMs });

async function history(user, requestedPage = 1, requestedLimit = 8) {
  const page = Number(requestedPage), limit = Number(requestedLimit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw error(400, 'Choose a positive history page and a page size from 1 to 50.');
  await finishLegacyInterviews(user);
  const total = await SkillerAttempt.countDocuments({ user });
  const pages = Math.max(1, Math.ceil(total / limit)), currentPage = Math.min(page, pages);
  const attempts = await SkillerAttempt.find({ user }).select(historyFields).populate('problem', 'title').sort({ createdAt: -1, _id: -1 }).skip((currentPage - 1) * limit).limit(limit).lean();
  return { attempts: attempts.map(attemptSummary), total, page: currentPage, pages, limit };
}
const plain = (document) => document?.toObject ? document.toObject({ flattenMaps: true }) : document;
function publicProblem(problem) {
  const item = plain(problem);
  return Object.fromEntries(['_id', 'slug', 'title', 'topic', 'difficulty', 'description', 'inputFormat', 'outputFormat', 'constraints', 'sampleTestCases', 'starterCode', 'timeLimitMs', 'memoryLimitMb'].map((key) => [key, item[key]]));
}
function publicAttempt(document) {
  const attempt = plain(document), problem = attempt.problem;
  return {
    id: String(attempt._id), problem: publicProblem(problem), topic: attempt.topic, difficulty: attempt.difficulty, kind: attempt.kind, reason: attempt.reason,
    state: attempt.state, active: attempt.active, language: attempt.language, code: attempt.code || '', draftRevision: attempt.draftRevision,
    runs: attempt.runs, submissions: attempt.submissions, hints: (attempt.hintsUsed || []).map((index) => problem.hints?.[index]).filter(Boolean), hintsAvailable: Math.max(0, (problem.hints?.length || 0) - (attempt.hintsUsed?.length || 0)),
    startedAt: attempt.startedAt, completedAt: attempt.completedAt, elapsedMs: attempt.elapsedMs, result: attempt.result || null, lastRun: attempt.lastRun || null,
    processing: !!attempt.processingAt && Date.now() - new Date(attempt.processingAt).getTime() < LEASE_MS,
  };
}
async function ownedAttempt(user, id) {
  if (!mongoose.isValidObjectId(id)) throw error(404, 'Practice attempt not found.');
  const attempt = await SkillerAttempt.findOne({ _id: id, user }).select('+code +evaluations +processingToken').populate({ path: 'problem', select: '+hiddenTestCases +hints' });
  if (!attempt?.problem) throw error(404, 'Practice attempt not found.');
  return attempt;
}
function unlocked() { return { $or: [{ processingAt: null }, { processingAt: { $lt: new Date(Date.now() - LEASE_MS) } }] }; }
async function lock(user, id, state, revision) {
  const token = randomUUID();
  const record = await SkillerAttempt.findOneAndUpdate({ _id: id, user, active: true, state, ...(revision == null ? {} : { draftRevision: revision }), ...unlocked() }, { $set: { processingAt: new Date(), processingToken: token } }, { new: true });
  if (!record) throw error(409, 'This attempt is locked or another request is still running. Refresh the attempt before retrying.');
  return token;
}
async function release(id, token) { await SkillerAttempt.updateOne({ _id: id, processingToken: token }, { $set: { processingAt: null, processingToken: null } }); }

async function finishLegacyInterviews(user) {
  const now = new Date();
  await SkillerAttempt.updateMany({ user, state: 'interview', ...unlocked() }, [{ $set: { state: 'complete', active: false, completedAt: now, elapsedMs: { $max: [0, { $subtract: [now, '$startedAt'] }] } } }]);
}

async function dashboard(user) {
  await ensureBank();
  await finishLegacyInterviews(user);
  const calculatedAt = new Date();
  const [profile, attempts, bankCount] = await Promise.all([profileFor(user), historyFor(user), SkillerProblem.countDocuments()]);
  const profileData = plain(profile), topics = topicMap(profileData, attempts);
  const solved = new Set(attempts.filter((attempt) => attempt.result?.status === 'accepted').map((attempt) => String(attempt.problem?._id || attempt.problem)));
  const stats = { uniqueSolved: solved.size, attempts: attempts.length, submissions: attempts.reduce((sum, attempt) => sum + attempt.submissions, 0), sampleRuns: attempts.reduce((sum, attempt) => sum + attempt.runs, 0), strongTopics: topics.filter((topic) => topic.status === 'strong').length };
  const weakTopics = topics.filter((topic) => topic.status === 'needs-practice').map((topic) => topic.id);
  await SkillerProfile.updateOne({ user, $or: [{ progressUpdatedAt: { $lte: calculatedAt } }, { progressUpdatedAt: { $exists: false } }] }, { $set: {
    weakTopics, practiceStats: stats, progressUpdatedAt: calculatedAt,
    topicStrengths: topics.map((topic) => ({ topic: topic.id, score: topic.score, status: topic.status, confidence: topic.confidence, uniqueSolved: topic.uniqueSolved, uniqueTried: topic.uniqueTried, independentSolved: topic.independentSolved, submissions: topic.submissions, lastPracticedAt: topic.lastPracticedAt })),
  } });
  return {
    topics, weakTopics, links: profileData.links || [], diagnosticCompleted: !!profileData.diagnostic?.completedAt, bankCount, stats,
    activeAttempt: attempts.find((attempt) => attempt.active)?._id || null,
    recentAttempts: attempts.slice(0, 12).map((attempt) => ({ id: String(attempt._id), title: attempt.problem?.title || 'Practice problem', topic: attempt.topic, difficulty: attempt.difficulty, state: attempt.state, status: attempt.result?.status || null, submissions: attempt.submissions, startedAt: attempt.startedAt, completedAt: attempt.completedAt, elapsedMs: attempt.elapsedMs, interviewScore: attempt.interview?.feedback?.score ?? null, interviewSource: attempt.interview?.feedback?.source || null })),
  };
}
const diagnostic = () => DIAGNOSTIC.map(({ answer, explanation, ...question }) => question);
async function saveDiagnostic(user, answers) {
  await ensureBank();
  if (answers.length !== DIAGNOSTIC.length || new Set(answers.map((item) => item.questionId)).size !== DIAGNOSTIC.length || answers.some((item) => !DIAGNOSTIC.some((question) => question.id === item.questionId))) throw error(400, 'Answer every diagnostic question once, or choose Not sure.');
  const graded = answers.map((item) => ({ ...item, correct: item.option == null ? null : DIAGNOSTIC.find((question) => question.id === item.questionId).answer === item.option }));
  await profileFor(user);
  await SkillerProfile.updateOne({ user }, { $set: { diagnostic: { completedAt: new Date(), answers: graded } } });
  return { dashboard: await dashboard(user), results: graded.map((item) => ({ ...item, explanation: DIAGNOSTIC.find((question) => question.id === item.questionId).explanation })) };
}
async function saveLink(user, provider, url) {
  await ensureBank();
  const link = parseProfile(provider, url), profile = await profileFor(user);
  let imported = await importPublicTopics(link);
  const previous = profile.links.find((item) => item.provider === provider && item.username === link.username);
  if (imported.status === 'unavailable' && previous?.status === 'imported') imported = { ...plain(previous), message: 'Refresh unavailable; using the previously imported public counts.' };
  await SkillerProfile.updateOne({ user }, [{ $set: { links: { $concatArrays: [{ $filter: { input: { $ifNull: ['$links', []] }, as: 'link', cond: { $ne: ['$$link.provider', provider] } } }, { $literal: [imported] }] } } }]);
  return { link: imported, dashboard: await dashboard(user) };
}
async function removeLink(user, provider) { await SkillerProfile.updateOne({ user }, { $pull: { links: { provider } } }); return dashboard(user); }

async function nextAttempt(user, topic) {
  await ensureBank();
  await finishLegacyInterviews(user);
  const existing = await SkillerAttempt.findOne({ user, active: true });
  if (existing) return publicAttempt(await ownedAttempt(user, existing._id));
  const [profile, attempts, problems] = await Promise.all([profileFor(user), historyFor(user), SkillerProblem.find().lean()]);
  const recommendation = recommend(problems, topicMap(plain(profile), attempts), attempts, topic);
  if (!recommendation) throw error(503, 'No Skiller problems are available. Please try again later.');
  try {
    const record = await SkillerAttempt.create({ user, problem: recommendation.problem._id, topic: recommendation.problem.topic, difficulty: recommendation.problem.difficulty, kind: recommendation.kind, reason: recommendation.reason, code: recommendation.problem.starterCode.python });
    await dashboard(user);
    return publicAttempt(await ownedAttempt(user, record._id));
  } catch (failure) {
    if (failure.code !== 11000) throw failure;
    const record = await SkillerAttempt.findOne({ user, active: true });
    if (!record) throw failure;
    return publicAttempt(await ownedAttempt(user, record._id));
  }
}
async function getAttempt(user, id) {
  await ownedAttempt(user, id);
  await dashboard(user);
  return publicAttempt(await ownedAttempt(user, id));
}
async function saveDraft(user, id, language, code, revision) {
  await ownedAttempt(user, id);
  const updated = await SkillerAttempt.findOneAndUpdate({ _id: id, user, active: true, state: 'coding', draftRevision: revision, ...unlocked() }, { $set: { language, code }, $inc: { draftRevision: 1 } }, { new: true });
  if (!updated) throw error(409, 'A newer draft or evaluation exists. Reopen the latest attempt before saving again.');
  return { draftRevision: updated.draftRevision };
}
async function revealHint(user, id) {
  const attempt = await ownedAttempt(user, id), index = attempt.hintsUsed.length;
  if (index >= attempt.problem.hints.length) return publicAttempt(attempt);
  const updated = await SkillerAttempt.findOneAndUpdate({ _id: id, user, state: 'coding', active: true, hintsUsed: attempt.hintsUsed, ...unlocked() }, { $push: { hintsUsed: index } }, { new: true });
  if (!updated) throw error(409, 'The attempt changed. Refresh before revealing another hint.');
  return publicAttempt(await ownedAttempt(user, id));
}

function sanitizeResult(raw, visibleCount, allTests) {
  const text = (value) => value == null ? '' : String(value).slice(0, 6000);
  return {
    status: raw.status, passedCount: raw.passedCount || 0, totalCount: raw.totalCount || 0, executionTimeMs: raw.executionTimeMs || 0,
    error: !allTests ? text(raw.error) : raw.error ? 'A test could not complete. Run the samples for visible debugging details.' : '',
    // Full submissions share the executor's files across cases. Even sample
    // stdout or compiler diagnostics can contain hidden data printed by code.
    testResults: (raw.testResults || []).map((test, index) => ({ passed: !!test.passed, timeMs: test.timeMs || 0, hidden: allTests && index >= visibleCount, ...(!allTests ? { output: text(test.output), expected: text(test.expectedOutput ?? test.expected), error: text(test.error) } : {}) })),
  };
}
async function evaluate(user, id, input, submit) {
  const attempt = await ownedAttempt(user, id), kind = submit ? 'submit' : 'run';
  if (attempt.evaluations.some((entry) => entry.requestId === input.requestId && entry.kind === kind)) return getAttempt(user, id);
  const token = await lock(user, id, 'coding', input.revision);
  try {
    await SkillerAttempt.updateOne({ _id: id, processingToken: token }, { $set: { code: input.code, language: input.language }, $inc: { draftRevision: 1 } });
    const tests = submit ? [...attempt.problem.sampleTestCases, ...attempt.problem.hiddenTestCases] : attempt.problem.sampleTestCases;
    const raw = await runSubmission({ language: input.language, code: input.code, testCases: tests.map((test) => ({ input: test.input, expectedOutput: test.expectedOutput })), timeLimitMs: attempt.problem.timeLimitMs, memoryLimitMb: attempt.problem.memoryLimitMb });
    const result = sanitizeResult(raw, attempt.problem.sampleTestCases.length, submit), accepted = submit && result.status === 'accepted' && result.totalCount > 0 && result.passedCount === result.totalCount;
    if (submit && result.status === 'accepted' && !accepted) throw error(502, 'The evaluator returned an incomplete result. Please retry.');
    const now = new Date();
    const set = submit ? { result, ...(accepted ? { state: 'complete', active: false, acceptedAt: now, completedAt: now, elapsedMs: Math.max(0, now - new Date(attempt.startedAt)) } : {}) } : { lastRun: result };
    const updated = await SkillerAttempt.updateOne({ _id: id, user, processingToken: token, state: 'coding' }, { $set: set, $inc: { [submit ? 'submissions' : 'runs']: 1 }, $push: { evaluations: { $each: [{ requestId: input.requestId, kind, result, at: new Date() }], $slice: -200 } } });
    if (!updated.matchedCount) throw error(409, 'This evaluation was superseded. Reload the attempt.');
  } finally { await release(id, token); }
  return getAttempt(user, id);
}
async function abandon(user, id) {
  await ownedAttempt(user, id);
  const updated = await SkillerAttempt.updateOne({ _id: id, user, active: true, state: 'coding', ...unlocked() }, { $set: { state: 'abandoned', active: false, completedAt: new Date() } });
  if (!updated.matchedCount) throw error(409, 'Only an idle coding attempt can be left. Reload the saved attempt.');
  return dashboard(user);
}

module.exports = { dashboard, history, diagnostic, saveDiagnostic, saveLink, removeLink, nextAttempt, getAttempt, saveDraft, revealHint, evaluate, abandon, ensureBank, sanitizeResult, publicProblem };
