const Problem = require('../models/Problem');

const getProblems = async (req, res) => {
  try {
    const { difficulty, category, tag, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const filter = {};

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    if (category) {
      filter.category = category;
    }

    if (tag) {
      filter.tags = tag;
    }

    if (search) {
      filter.title = { $regex: String(search).trim(), $options: 'i' };
    }

    const [problems, total] = await Promise.all([
      Problem.find(filter)
        .select('title slug difficulty category tags')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Problem.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        problems,
        total,
        page,
        limit,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getProblemBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug).toLowerCase().trim();
    const problem = await Problem.findOne({ slug }).select('-hiddenTestCases');

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    return res.json({
      success: true,
      data: {
        problem,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProblems,
  getProblemBySlug,
};
