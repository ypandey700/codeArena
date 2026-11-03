const Problem = require('../models/Problem');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { runSubmission } = require('../services/codeRunnerService');

const XP_MAP = {
  easy: 10,
  medium: 20,
  hard: 30,
};

const runCode = async (req, res) => {
  try {
    const { problemId, slug, language, code, customInput } = req.body;

    if (!language || !code) {
      return res.status(400).json({ message: 'Language and code are required' });
    }

    let testCases = [];
    let timeLimitMs = 2000;
    let memoryLimitMb = 256;

    if (customInput !== undefined && customInput !== null) {
      testCases = [{ input: String(customInput), expectedOutput: '' }];
    } else {
      let problem = null;
      if (problemId) {
        problem = await Problem.findById(problemId);
      } else if (slug) {
        problem = await Problem.findOne({ slug: String(slug).toLowerCase().trim() });
      }

      if (!problem) {
        return res.status(404).json({ message: 'Problem not found' });
      }

      testCases = problem.sampleTestCases || [];
      timeLimitMs = problem.timeLimitMs || 2000;
      memoryLimitMb = problem.memoryLimitMb || 256;
    }

    const result = await runSubmission({
      language,
      code,
      testCases,
      timeLimitMs,
      memoryLimitMb,
    });

    return res.json({
      success: true,
      data: {
        status: result.status,
        error: result.error || '',
        testResults: result.testResults,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        executionTimeMs: result.executionTimeMs,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const submitCode = async (req, res) => {
  try {
    const { problemId, slug, language, code } = req.body;

    if (!language || !code) {
      return res.status(400).json({ message: 'Language and code are required' });
    }

    let problem = null;
    if (problemId) {
      problem = await Problem.findById(problemId).select('+hiddenTestCases');
    } else if (slug) {
      problem = await Problem.findOne({ slug: String(slug).toLowerCase().trim() }).select('+hiddenTestCases');
    }

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    const sampleTestCases = problem.sampleTestCases || [];
    const hiddenTestCases = problem.hiddenTestCases || [];
    const allTests = [...sampleTestCases, ...hiddenTestCases];

    const result = await runSubmission({
      language,
      code,
      testCases: allTests,
      timeLimitMs: problem.timeLimitMs || 2000,
      memoryLimitMb: problem.memoryLimitMb || 256,
    });

    const sanitizedResults = (result.testResults || []).map((tr, idx) => {
      if (idx < sampleTestCases.length) {
        return tr;
      }
      return {
        passed: tr.passed,
        output: '',
        expected: '',
        timeMs: tr.timeMs,
      };
    });

    const submission = await Submission.create({
      user: req.user._id,
      problem: problem._id,
      language,
      code,
      status: result.status,
      error: result.error || '',
      testResults: sanitizedResults,
      passedCount: result.passedCount,
      totalCount: result.totalCount,
      executionTimeMs: result.executionTimeMs,
    });

    const userUpdate = {
      $inc: {
        'stats.submissions': 1,
      },
    };

    if (result.status === 'accepted') {
      const priorAccepted = await Submission.findOne({
        user: req.user._id,
        problem: problem._id,
        status: 'accepted',
        _id: { $ne: submission._id },
      });

      if (!priorAccepted) {
        const xpGain = XP_MAP[problem.difficulty] || 10;
        userUpdate.$inc['stats.problemsSolved'] = 1;
        userUpdate.$inc.xp = xpGain;
      }
    }

    await User.findByIdAndUpdate(req.user._id, userUpdate);

    return res.status(201).json({
      success: true,
      data: {
        submission,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getMySubmissions = async (req, res) => {
  try {
    const { problemId } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const filter = {
      user: req.user._id,
    };

    if (problemId) {
      filter.problem = problemId;
    }

    const [submissions, total] = await Promise.all([
      Submission.find(filter)
        .populate('problem', 'title slug difficulty')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Submission.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        submissions,
        total,
        page,
        limit,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id).populate('problem', 'title slug difficulty');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (submission.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({
      success: true,
      data: {
        submission,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  runCode,
  submitCode,
  getMySubmissions,
  getSubmissionById,
};
