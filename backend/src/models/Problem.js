const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      required: true,
    },
    expectedOutput: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      required: true,
      enum: ['easy', 'medium', 'hard'],
    },
    category: {
      type: String,
      enum: ['dsa', 'debug', 'web', 'sql'],
      default: 'dsa',
    },
    tags: {
      type: [String],
      default: [],
    },
    constraints: {
      type: String,
      default: '',
    },
    sampleTestCases: [testCaseSchema],
    hiddenTestCases: {
      type: [testCaseSchema],
      select: false,
    },
    starterCode: {
      python: {
        type: String,
        default: '',
      },
      javascript: {
        type: String,
        default: '',
      },
      cpp: {
        type: String,
        default: '',
      },
      java: {
        type: String,
        default: '',
      },
    },
    timeLimitMs: {
      type: Number,
      default: 2000,
    },
    memoryLimitMb: {
      type: Number,
      default: 256,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Problem', problemSchema);
