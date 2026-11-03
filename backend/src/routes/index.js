const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const problemRoutes = require('./problemRoutes');
const submissionRoutes = require('./submissionRoutes');

router.get('/', (req, res) => {
  res.json({
    message: 'CodingArena API v1 is live',
    version: '1.0.0',
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/problems', problemRoutes);
router.use('/submissions', submissionRoutes);

module.exports = router;
