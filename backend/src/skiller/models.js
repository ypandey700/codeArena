const mongoose = require('mongoose');
const { TOPICS } = require('./curriculum');
const topicIds = TOPICS.map((topic) => topic.id);
const testSchema = new mongoose.Schema({ input: { type: String, default: '' }, expectedOutput: { type: String, required: true } }, { _id: false });
const problemSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true }, title: String, topic: { type: String, enum: topicIds, required: true }, difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  description: String, inputFormat: String, outputFormat: String, constraints: String,
  sampleTestCases: [testSchema], hiddenTestCases: { type: [testSchema], select: false }, hints: { type: [String], select: false },
  starterCode: { python: String, javascript: String, cpp: String, java: String }, timeLimitMs: Number, memoryLimitMb: Number, version: Number,
}, { timestamps: true, collection: 'skiller_problems' });

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  links: [{ _id: false, provider: { type: String, enum: ['leetcode', 'gfg', 'codechef'] }, username: String, url: String, status: String, message: String, linkedAt: Date, importedAt: Date, topicCounts: { type: Map, of: Number } }],
  diagnostic: { completedAt: Date, answers: [{ _id: false, questionId: String, option: { type: Number, default: null }, correct: { type: Boolean, default: null } }] },
  weakTopics: [{ type: String, enum: topicIds }],
  topicStrengths: [{ _id: false, topic: { type: String, enum: topicIds }, score: { type: Number, default: null }, status: String, confidence: String, uniqueSolved: Number, uniqueTried: Number, independentSolved: Number, submissions: Number, lastPracticedAt: Date }],
  practiceStats: { uniqueSolved: Number, attempts: Number, submissions: Number, sampleRuns: Number, strongTopics: Number },
  progressUpdatedAt: Date,
}, { timestamps: true, collection: 'skiller_profiles' });

const resultSchema = new mongoose.Schema({ status: String, passedCount: Number, totalCount: Number, executionTimeMs: Number, error: String, testResults: [mongoose.Schema.Types.Mixed] }, { _id: false });
const attemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, problem: { type: mongoose.Schema.Types.ObjectId, ref: 'SkillerProblem', required: true },
  topic: { type: String, enum: topicIds, required: true }, difficulty: String, kind: { type: String, enum: ['practice', 'review'], default: 'practice' }, reason: String,
  active: { type: Boolean, default: true }, state: { type: String, enum: ['coding', 'interview', 'complete', 'abandoned'], default: 'coding' },
  language: { type: String, enum: ['python', 'javascript', 'cpp', 'java'], default: 'python' }, code: { type: String, default: '', select: false }, draftRevision: { type: Number, default: 0 },
  runs: { type: Number, default: 0 }, submissions: { type: Number, default: 0 }, hintsUsed: { type: [Number], default: [] },
  startedAt: { type: Date, default: Date.now }, completedAt: Date, elapsedMs: Number, acceptedAt: Date,
  result: resultSchema, lastRun: resultSchema,
  evaluations: { type: [{ _id: false, requestId: String, kind: String, at: Date, result: resultSchema }], select: false },
  processingAt: { type: Date, default: null }, processingToken: { type: String, default: null, select: false },
  interview: { source: String, requestId: String, questions: [{ _id: false, text: String, answer: { type: String, default: '' } }], feedback: { source: String, score: { type: Number, default: null }, strengths: [String], tips: [String] }, answeredAt: Date },
}, { timestamps: true, collection: 'skiller_attempts' });
attemptSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { active: true }, name: 'one_active_skiller_attempt' });
attemptSchema.index({ user: 1, createdAt: -1 });

module.exports = {
  SkillerProblem: mongoose.models.SkillerProblem || mongoose.model('SkillerProblem', problemSchema),
  SkillerProfile: mongoose.models.SkillerProfile || mongoose.model('SkillerProfile', profileSchema),
  SkillerAttempt: mongoose.models.SkillerAttempt || mongoose.model('SkillerAttempt', attemptSchema),
};
