const express = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const redis = require('../config/redis');
const service = require('./service');
const { TOPICS } = require('./curriculum');
const router = express.Router();
const language = z.enum(['python', 'javascript', 'cpp', 'java']);
const provider = z.enum(['leetcode', 'gfg', 'codechef']);
const requestId = z.string().regex(/^[a-zA-Z0-9-]{8,80}$/);
const source = z.string().min(1).max(20000).refine((code) => code.trim().length > 0, 'Write some code before evaluating.');
const fallback = new Map();
function limit(scope, maximum) {
  return async (req, res, next) => {
    const key = `skiller:limit:${scope}:${req.user._id}`;
    try {
      if (redis.status === 'ready') { const count = await redis.incr(key); if (count === 1) await redis.expire(key, 60); if (count > maximum) return res.status(429).json({ message: 'Too many Skiller requests. Try again in a minute.' }); return next(); }
    } catch {}
    const now = Date.now();
    for (const [entry, value] of fallback) if (value.until <= now) fallback.delete(entry);
    const bucket = fallback.get(key) || { count: 0, until: now + 60000 }; bucket.count++; fallback.set(key, bucket);
    if (bucket.count > maximum) return res.status(429).json({ message: 'Too many Skiller requests. Try again in a minute.' });
    next();
  };
}
const body = (schema) => (req, res, next) => { const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid request.' }); req.input = parsed.data; next(); };
const route = (handler) => async (req, res) => { try { res.json({ success: true, data: await handler(req) }); } catch (error) { res.status(error.status || (error instanceof z.ZodError ? 400 : 500)).json({ message: error instanceof z.ZodError ? 'Choose a supported profile provider.' : error.status ? error.message : 'Skiller could not complete this request. Your saved progress is retained.' }); } };
router.use(auth);
router.get('/', route((req) => service.dashboard(req.user._id)));
router.get('/history', route((req) => service.history(req.user._id, req.query.page, req.query.limit)));
router.get('/diagnostic', route(() => ({ questions: service.diagnostic() })));
router.post('/diagnostic', limit('diagnostic', 5), body(z.object({ answers: z.array(z.object({ questionId: z.string().max(60), option: z.number().int().min(0).max(3).nullable() })).length(12) })), route((req) => service.saveDiagnostic(req.user._id, req.input.answers)));
router.put('/profiles/:provider', limit('profiles', 6), body(z.object({ url: z.string().url().max(300) })), route((req) => service.saveLink(req.user._id, provider.parse(req.params.provider), req.input.url)));
router.delete('/profiles/:provider', route((req) => service.removeLink(req.user._id, provider.parse(req.params.provider))));
router.post('/next', limit('next', 20), body(z.object({ topic: z.enum(TOPICS.map((topic) => topic.id)).optional() })), route((req) => service.nextAttempt(req.user._id, req.input.topic)));
router.get('/attempts/:id', route((req) => service.getAttempt(req.user._id, req.params.id)));
router.patch('/attempts/:id/draft', limit('draft', 90), body(z.object({ language, code: z.string().max(20000), revision: z.number().int().min(0) })), route((req) => service.saveDraft(req.user._id, req.params.id, req.input.language, req.input.code, req.input.revision)));
router.post('/attempts/:id/hint', limit('hint', 20), route((req) => service.revealHint(req.user._id, req.params.id)));
router.post('/attempts/:id/run', limit('evaluate', 10), body(z.object({ language, code: source, requestId, revision: z.number().int().min(0) })), route((req) => service.evaluate(req.user._id, req.params.id, req.input, false)));
router.post('/attempts/:id/submit', limit('evaluate', 10), body(z.object({ language, code: source, requestId, revision: z.number().int().min(0) })), route((req) => service.evaluate(req.user._id, req.params.id, req.input, true)));
router.post('/attempts/:id/abandon', limit('abandon', 20), route((req) => service.abandon(req.user._id, req.params.id)));
module.exports = router;
