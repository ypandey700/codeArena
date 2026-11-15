const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    record: { type: mongoose.Schema.Types.Mixed, default: null },
    ratingBefore: {
      type: Number,
      required: true,
    },
    ratingAfter: {
      type: Number,
      default: null,
    },
    ratingDelta: {
      type: Number,
      default: null,
    },
    xpGained: {
      type: Number,
      default: 0,
    },
    response: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
    bestPassed: {
      type: Number,
      default: 0,
    },
    totalTests: {
      type: Number,
      default: 0,
    },
    solvedAt: {
      type: Date,
      default: null,
    },
    phase: { type: String, enum: ['coding', 'interview', 'done'], default: 'coding' },
    evaluationReady: { type: Boolean, default: false },
    analysisCompletedAt: Date,
    codingProcessedAt: Date,
    interview: { type: mongoose.Schema.Types.Mixed, default: null },
    codeUpdatedAt: Date,
    finishedAt: Date,
    finishing: { type: Boolean, default: false },
    runtimeMs: { type: Number, default: null },
    finalCode: { type: String, default: '', select: false },
    language: String,
    myTests: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
    analysis: { type: mongoose.Schema.Types.Mixed, default: null },
    scores: { type: mongoose.Schema.Types.Mixed, default: null },
    finishedBy: { type: String, enum: ['solved', 'locked', 'timeout', 'forfeit'] },
    resultSource: { type: String, enum: ['submit', 'auto_draft', 'none'], default: 'none' },
    lastSubmissionAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    passedCount: {
      type: Number,
      required: true,
    },
    totalCount: {
      type: Number,
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const battleSchema = new mongoose.Schema(
  {
    players: [playerSchema],
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true,
    },
    mode: {
      type: String,
      default: 'ranked_1v1',
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'finalizing', 'finished', 'cancelled', 'abandoned'],
      default: 'pending',
    },
    acceptDeadline: {
      type: Date,
    },
    battleDurationMs: Number,
    startedAt: {
      type: Date,
    },
    endsAt: {
      type: Date,
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: {
      type: String,
      enum: ['solved', 'time', 'forfeit', 'disconnect', 'draw', null],
      default: null,
    },
    timeline: [timelineSchema],
  },
  {
    timestamps: true,
  }
);

battleSchema.index({ 'players.user': 1, status: 1, createdAt: -1 });
battleSchema.index({ status: 1, endsAt: 1 });

module.exports = mongoose.model('Battle', battleSchema);
