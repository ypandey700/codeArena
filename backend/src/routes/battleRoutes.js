const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const battleController = require('../controllers/battleController');

router.get('/active', auth, battleController.getActiveBattle);
router.get('/me', auth, battleController.getMyBattles);
router.get('/:id', auth, battleController.getBattleById);
router.post('/:id/submit', auth, battleController.submitBattleCode);

module.exports = router;
