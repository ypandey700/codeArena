const { createHash } = require('node:crypto');
const { normalizeCode, codeTokens } = require('./starterCode');

const digest = (value) => createHash('sha256').update(value).digest('hex');
const normalizeText = (text) => String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const questionKeys = (question) => {
  const keys = [`text:${normalizeText(question.text || question.question)}`];
  if (question.focus) keys.push(`focus:${normalizeText(question.focus)}`);
  if (question.type && question.evidence) keys.push(`evidence:${question.type}:${String(question.evidence).trim().replace(/\s+/g, ' ')}`);
  return keys.map(digest);
};
const uniqueQuestion = (candidate, history) => {
  const keys = new Set(history.flatMap(questionKeys));
  return questionKeys(candidate).every((key) => !keys.has(key));
};

const constructs = [
  ['sorting', /\b(?:sort|sorted|stable_sort)\s*\(/, 'ordering', 'What does putting the values in order let your solution do?'],
  ['map', /\b(?:Map|HashMap|TreeMap|unordered_map|map|dict)\b|=\s*\{\s*\}/, 'storage', 'Why does your solution store values that it can look up by a key?'],
  ['set', /\b(?:Set|HashSet|TreeSet|unordered_set|set)\b/, 'storage', 'How does keeping a set help your solution decide which values it has already seen?'],
  ['stack', /\b(?:Stack|stack|Deque|push|pop|push_back|pop_back)\b/, 'storage', 'Why does the order in which you add and remove items matter here?'],
  ['two pointers', /\b(?:left|lo|low|start|slow)\b.*\b(?:right|hi|high|end|fast)\b|\b(?:i|j)\s*[<>]\s*(?:j|i)\b/, 'boundaries', 'How do you decide which position to move when narrowing the range?'],
  ['loop', /\b(?:for|while)\b/, 'iteration', 'What stays true each time this loop processes another item?'],
  ['conditional', /\b(?:if|elif|else|switch|case)\b|\?.*:/, 'decision', 'What different behavior does this condition let your solution handle?'],
  ['indexing', /\b\w+\s*\[[^\]]+\]|\.\s*(?:at|charAt)\s*\(/, 'access', 'How does your solution choose the position to read without going outside the input?'],
  ['output', /\b(?:print|println|printf|cout|console \. log)\b/, 'output', 'How did you choose what to print from your solution?'],
  ['helper variable', /\b\w+\s*(?:\+=|-=|=(?!=))/, 'state', 'What information does this saved value help you carry forward?'],
];

const sourceLines = (code, language, starter) => {
  const unchanged = new Set([starter].flat().flatMap((template) => String(template || '').split(/\r?\n/)).map((line) => normalizeCode(line, language)));
  const source = code.split(/\r?\n/);
  const offsets = [...code.matchAll(/\n/g)].map((match) => match.index);
  const lines = source.map((line) => ({ raw: line, evidence: line.trim(), tokens: [], codeTokens: [] }));
  let index = 0;
  for (const token of codeTokens(code, language)) {
    while (token.index > offsets[index]) index++;
    lines[index].tokens.push(token[0]);
    if (!token[2]) lines[index].codeTokens.push(token[0]);
  }
  return lines.filter(({ evidence, tokens }) => tokens.length && !unchanged.has(tokens.join(' ')) && !/^[{};]+$/.test(evidence))
    .map(({ raw, evidence, codeTokens }) => ({ raw, evidence, tokens: codeTokens.join(' ') }));
};

const authoredCode = (code, language, starter) => sourceLines(code, language, starter).map(({ raw }) => raw).join('\n');

const analyzeCode = (code, language, starter) => {
  const lines = sourceLines(code, language, starter);
  const candidates = new Map();
  const add = (focus, type, question, evidence) => {
    if (!candidates.has(focus)) candidates.set(focus, { focus, type, question, evidence });
  };
  for (const [focus, pattern, type, question] of constructs) {
    const match = lines.find(({ tokens }) => pattern.test(tokens));
    if (match) add(focus, type, question, match.evidence);
  }
  const indent = (line) => line.raw.match(/^\s*/)[0].length;
  for (const [index, line] of lines.entries()) {
    const { evidence, tokens } = line;
    const previous = lines[index - 1];
    if (/\b(?:break|continue)\b|\bif\b.*\breturn\b/.test(tokens) ||
        (/^return\b/.test(tokens) && previous && /\b(?:if|elif|else)\b/.test(previous.tokens) &&
         (language !== 'python' || indent(line) > indent(previous)))) {
      add('early return', 'termination', 'How do you know when it is safe to stop this part of your solution?', evidence);
    }
    const declaration = tokens.match(/\b(?:def|function)\s+(\w+)\s*\(/) ||
      tokens.match(/^(?:(?:public|private|static|inline|final|protected|virtual)\s+)*[\w]+(?:\s*<[^>]+>)?(?:\s*\[\s*\])?(?:\s*[*&])?\s+(\w+)\s*\([^;]*?\)\s*\{/) ||
      tokens.match(/\b(?:const|let|var)\s+(\w+)\s*=.*=>/);
    if (!declaration || ['if', 'for', 'while', 'switch'].includes(declaration[1])) continue;
    add('function', 'decomposition', 'What work does this function handle for the rest of the solution?', evidence);
    const call = new RegExp(`\\b${declaration[1]}\\s*\\(`);
    const end = lines.findIndex((next, i) => i > index && (language === 'python'
      ? indent(next) <= indent(line)
      : indent(next) <= indent(line) && !next.tokens.startsWith('}')));
    const body = lines.slice(index + 1, end < 0 ? undefined : end);
    const recursion = [line, ...body].find((entry) => {
      const code = entry === line ? tokens.slice((declaration.index || 0) + declaration[0].length) : entry.tokens;
      return call.test(code);
    });
    if (recursion) add('recursion', 'decomposition', 'What makes each recursive call move closer to an answer?', recursion.evidence);
  }
  const loops = lines.filter(({ tokens }) => /\b(?:for|while)\b/.test(tokens));
  if (loops.length > 1) add('repeated iteration', 'complexity', 'How does having more than one loop affect the amount of work as the input grows?', loops[1].evidence);
  return { candidates: [...candidates.values()], evidence: lines[0]?.evidence || code.trim() };
};

const scenarios = [
  ['the smallest allowed input', 'an input with many items', 'the first item in the input', 'the last item in the input', 'an input near the size limit'],
  ['an unusual valid input', 'a typical valid input', 'an input with only one kind of value', 'an input with varied values', 'a boundary case you would test'],
];
const angles = [
  ['edge cases', 'How would you check that your solution handles'],
  ['complexity', 'Which part of your solution would do the most work on'],
  ['alternative approach', 'What could you simplify in your solution if you only had to handle'],
  ['failure modes', 'What mistake in your solution would be easiest to catch with'],
];

const codeQuestion = (code, index, history = [], { userId = '', seat = 0, language, starter } = {}) => {
  const { candidates, evidence } = analyzeCode(code, language, starter);
  const seed = digest(JSON.stringify([code, userId]));
  const pick = (choices) => choices.map((choice) => ({ choice, rank: digest(seed + index + choice.focus) }))
    .sort((a, b) => a.rank.localeCompare(b.rank)).map(({ choice }) => choice).find((choice) => uniqueQuestion(choice, history));
  return pick(candidates) || pick(angles.flatMap(([type, wording]) => scenarios[seat].map((scenario) => ({
    question: `${wording} ${scenario}?`, focus: `${type} ${scenario}`, type: `${type} ${scenario}`, evidence,
  }))));
};

const groundedQuestion = (result, code, language, starter) => {
  if (typeof result?.question !== 'string' || typeof result.evidence !== 'string') return null;
  const question = result.question.trim();
  const evidence = result.evidence.trim();
  if (!question || !evidence || evidence.length < 3 || !code.includes(evidence) || question.split(/\s+/).length > 30 ||
      !/\b(why|how|what|which|explain)\b/i.test(question) || /\bline\s+\d+|`|\b\w+\.\w+|\b\w+\s*\(|walk me through|explain your approach/i.test(question) ||
      question.includes(evidence) || question.split('?').length > 2) return null;
  const authoredLines = sourceLines(code, language, starter);
  const relevantCode = authoredLines.filter((line) => line.evidence.includes(evidence) || evidence.includes(line.evidence))
    .map((line) => line.evidence.includes(evidence) ? evidence : line.raw).join('\n');
  const { candidates } = analyzeCode(relevantCode, language);
  const candidate = candidates.find(({ focus }) => normalizeText(focus) === normalizeText(result.focus)) || candidates[0];
  if (!candidate) return null;
  return { text: question, evidence, focus: candidate.focus, type: candidate.type };
};

module.exports = { analyzeCode, authoredCode, codeQuestion, groundedQuestion, questionKeys, uniqueQuestion };
