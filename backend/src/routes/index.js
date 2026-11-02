const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');

router.get('/', (req, res) => {
  res.json({
    message: 'CodingArena API v1 is live',
    version: '1.0.0',
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

module.exports = router;
