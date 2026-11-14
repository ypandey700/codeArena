const { getArenaStats } = require('../services/battleService');

const getStats = async (req, res) => {
  try {
    const stats = await getArenaStats();
    return res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getStats,
};
