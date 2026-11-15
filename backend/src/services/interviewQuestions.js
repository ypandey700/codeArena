// Deterministic, source-grounded questions when the AI service is unavailable.
const sourceLines = (code) => String(code || '').split('\n').map((text, index) => ({ text: text.trim(), line: index + 1 })).filter(({ text }) => text && !/^(\/\/|#|\/\*|\*|[{}]+$)/.test(text));
const groundedQuestion = (result, code) => typeof result.evidence === 'string' && result.evidence.trim().length >= 3 && code.includes(result.evidence.trim()) && /\b(why|how|what|which|explain|justify)\b/i.test(result.question) && !/walk me through|describe an edge case|explain your approach/i.test(result.question);
const codeQuestion = (code, index, history = []) => {
  const lines = sourceLines(code);
  const candidates = [];
  for (const { text, line } of lines) {
    const anchor = `line ${line} (${text.slice(0, 100)})`;
    if (/\b(for|while)\b/.test(text)) candidates.push({ question: `Why did you choose the loop at ${anchor}, and what invariant must hold after each iteration?`, focus: 'loop invariant' });
    if (/\bif\b|\?/.test(text)) candidates.push({ question: `What incorrect result does the condition at ${anchor} prevent, and what happens at its boundary?`, focus: 'condition correctness' });
    if (/Map|Set|\bdict\b|\bset\b|\{\}|\[\]/.test(text)) candidates.push({ question: `Why use the data structure at ${anchor}, and how would replacing it change lookup cost or duplicate handling?`, focus: 'data structure choice' });
    if (/\breturn\b/.test(text)) candidates.push({ question: `What guarantees the return at ${anchor} is correct, and could it terminate before considering a valid result?`, focus: 'return correctness' });
    if (/sort|sorted/.test(text)) candidates.push({ question: `Why is ordering needed at ${anchor}, and what would break if this step were removed?`, focus: 'ordering' });
  }
  const variants = [
    (anchor) => `Why is the operation at ${anchor} performed at this point, and what would break if it moved earlier?`,
    (anchor) => `How does ${anchor} behave on the smallest valid input, and which assumption makes it safe?`,
    (anchor) => `Which later operation depends on ${anchor}, and how would changing its value affect correctness?`,
    (anchor) => `What input would most stress ${anchor}, and why does your implementation handle it that way?`,
  ];
  for (const variant of variants) for (const { text, line } of lines) candidates.push({ question: variant(`line ${line} (${text.slice(0, 100)})`), focus: 'implementation reasoning' });
  const available = candidates.filter((candidate) => !history.some((entry) => entry.question === candidate.question));
  return available[0] || { question: `For discussion ${index + 1}, why does the exact submitted source ${JSON.stringify(String(code).slice(0, 100))} satisfy the output contract?`, focus: 'output contract' };
};
module.exports = { codeQuestion, groundedQuestion };
