const callLLM = async ({ system, user, maxTokens = 700, temperature = 0, purpose = 'analysis', timeoutMs }) => {
  if (process.env.LLM_MOCK === 'true') {
    if (purpose === 'interview_question') {
      const context = JSON.parse(user);
      const { codeQuestion } = require('./interviewQuestions');
      const entry = codeQuestion(context.code, context.history.length, [...context.history, ...context.opponentQuestions.map((text) => ({ text }))], { userId: context.playerId, seat: context.seat, language: context.language });
      return JSON.stringify(entry || null);
    }
    if (purpose === 'interview_score') {
      const context = JSON.parse(user);
      const answered = context.transcript.some((q) => q.status === 'answered' && q.answer.trim());
      return JSON.stringify({ perQuestion: context.transcript.map((q) => ({ accuracy: q.status === 'answered' && q.answer.trim() ? 8 : 0, depth: q.status === 'answered' && q.answer.trim() ? 8 : 0, clarity: q.status === 'answered' && q.answer.trim() ? 8 : 0 })), understanding: answered ? 8 : 0, strengths: answered ? ['Explains the approach clearly.'] : [], tips: answered ? ['Discuss edge cases explicitly.'] : ['Explain your reasoning in your answers.'] });
    }
    const code = user.split('<code>')[1]?.split('</code>')[0] || '';
    const nested = (code.match(/\bfor\s*\(/g) || []).length >= 2 && !/new Map/.test(code);
    const messy = /\bvar\b/.test(code);
    const quality = messy ? 3 : 8;
    return JSON.stringify({ timeComplexity: nested ? 'O(n^2)' : 'O(n)', spaceComplexity: /new Map|seen\s*=\s*\{/.test(code) ? 'O(n)' : 'O(1)', quality: { naming: quality, readability: quality, maintainability: quality, idioms: quality }, feedback: [nested ? 'Consider reducing repeated searches.' : messy ? 'Use descriptive names and smaller functions.' : 'Keep the approach clear.'] });
  }
  if (!process.env.LLM_API_KEY) return null;
  const anthropic = process.env.LLM_PROVIDER === 'anthropic';
  const base = (process.env.LLM_BASE_URL || (anthropic ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1')).replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(timeoutMs || Infinity, Number(process.env.LLM_TIMEOUT_MS) || 20000)));
  try {
    const response = await fetch(`${base}/${anthropic ? 'messages' : 'chat/completions'}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(anthropic ? { 'x-api-key': process.env.LLM_API_KEY, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${process.env.LLM_API_KEY}` }) },
      body: JSON.stringify(anthropic ? { model: process.env.LLM_MODEL || 'claude-sonnet-4-5', max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }] } : { model: process.env.LLM_MODEL || 'gpt-4o-mini', max_completion_tokens: maxTokens, ...(/^o[134]|^gpt-5/.test(process.env.LLM_MODEL || '') ? {} : { temperature }), messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return anthropic ? body.content?.filter((part) => part.type === 'text').map((part) => part.text).join('') : body.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

module.exports = { callLLM };
