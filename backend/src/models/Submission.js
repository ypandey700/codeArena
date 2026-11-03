const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema(
  {
    passed: {
      type: Boolean,
      required: true,
    },
    output: {
      type: String,
      default: '',
    },
    expected: {
      type: String,
      default: '',
    },
    timeMs: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: true,
    },
    language: {
      type: String,
      required: true,
      enum: ['python', 'javascript', 'cpp', 'java'],
    },
    code: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['accepted', 'wrong_answer', 'runtime_error', 'time_limit', 'compile_error'],
    },
    testResults: [testResultSchema],
    passedCount: {
      type: Number,
      default: 0,
    },
    totalCount: {
      type: Number,
      default: 0,
    },
    executionTimeMs: {
      type: Number,
      default: 0,
    },
    error: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

submissionSchema.index({ user: 1, problem: 1, createdAt: -1 });

module.exports = mongoose.model('Submission', submissionSchema);
