const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  index: { type: Number, required: true },
  text: { type: String, required: true },
  focus: String,
  evidence: String,
  type: String,
  askedAt: Date,
  deadlineAt: Date,
  answer: { type: String, default: '', maxlength: 2000 },
  inputMode: { type: String, enum: ['voice', 'typed'], default: 'typed' },
  answeredAt: Date,
  status: { type: String, enum: ['open', 'answered', 'skipped', 'expired'], default: 'open' },
  accuracy: { type: Number, default: 0 },
  depth: { type: Number, default: 0 },
  clarity: { type: Number, default: 0 },
}, { _id: false });

const interviewSchema = new mongoose.Schema({
  battle: { type: mongoose.Schema.Types.ObjectId, ref: 'Battle', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'active', 'done', 'skipped', 'failed'], default: 'pending' },
  startedAt: { type: Date, required: true },
  deadlineAt: { type: Date, required: true },
  total: { type: Number, required: true },
  questions: [questionSchema],
  understanding: { type: Number, default: 0 },
  score: { type: Number, default: null },
  gradeSource: { type: String, enum: ['llm', 'heuristic'] },
  heuristicScore: Number,
  questionKeys: { type: [String], default: undefined },
  feedback: { strengths: [String], tips: [String] },
  source: { type: String, enum: ['llm', 'fallback'], default: 'llm' },
  generating: { type: Boolean, default: false },
  scoring: { type: Boolean, default: false },
  notifiedAt: Date,
  revision: { type: Number, default: 0 },
}, { timestamps: true });

interviewSchema.index({ battle: 1, user: 1 }, { unique: true });
// An atomic backstop for two workers choosing a question from the same sibling snapshot.
interviewSchema.index({ battle: 1, questionKeys: 1 }, { unique: true, partialFilterExpression: { questionKeys: { $exists: true } } });
interviewSchema.index({ status: 1, deadlineAt: 1 });

module.exports = mongoose.model('Interview', interviewSchema);
