const express = require('express');
const router = express.Router();
const arenaController = require('../controllers/arenaController');

router.get('/stats', arenaController.getStats);

module.exports = router;
