const callLLM = async ({ system, user, maxTokens = 700 }) => {
  if (process.env.LLM_MOCK === 'true') {
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
  const timer = setTimeout(() => controller.abort(), Number(process.env.LLM_TIMEOUT_MS) || 20000);
  try {
    const response = await fetch(`${base}/${anthropic ? 'messages' : 'chat/completions'}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(anthropic ? { 'x-api-key': process.env.LLM_API_KEY, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${process.env.LLM_API_KEY}` }) },
      body: JSON.stringify(anthropic ? { model: process.env.LLM_MODEL || 'claude-sonnet-4-5', max_tokens: maxTokens, temperature: 0, system, messages: [{ role: 'user', content: user }] } : { model: process.env.LLM_MODEL || 'gpt-4o-mini', max_completion_tokens: maxTokens, ...(/^o[134]|^gpt-5/.test(process.env.LLM_MODEL || '') ? {} : { temperature: 0 }), messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
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
