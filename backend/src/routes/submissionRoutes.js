const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const {
  runCode,
  submitCode,
  getMySubmissions,
  getSubmissionById,
} = require('../controllers/submissionController');

router.post('/run', auth, rateLimit, runCode);
router.post('/', auth, rateLimit, submitCode);
router.get('/me', auth, getMySubmissions);
router.get('/:id', auth, getSubmissionById);

module.exports = router;
