const groundedQuestion = (result, code) => typeof result.evidence === 'string' && result.evidence.trim().length >= 3 && code.includes(result.evidence.trim()) && /\b(why|how|what|which|explain)\b/i.test(result.question) && !/\bline\s+\d+|`|\b\w+\.\w+|\b\w+\s*\(|walk me through|explain your approach/i.test(result.question) && !result.question.includes(result.evidence.trim()) && result.question.split('?').length <= 2;

const codeQuestion = (code, index, history = []) => {
  const source = String(code || '');
  const candidates = [];
  const add = (pattern, question, focus) => { if (pattern.test(source)) candidates.push({ question, focus }); };
  add(/toupper|upper\s*\(|toUpperCase/i, 'Why are you converting the text to uppercase?', 'case normalization');
  add(/tolower|lower\s*\(|toLowerCase/i, 'Why are you converting the text to lowercase?', 'case normalization');
  add(/Map|\bdict\b|unordered_map|HashMap/, 'Why did you choose a map to store the values you have already seen?', 'data structure choice');
  add(/Set|\bset\b|unordered_set|HashSet/, 'How does using a set help you handle repeated values?', 'duplicate handling');
  add(/sort|sorted/i, 'Why do you need to sort the values before processing them?', 'ordering');
  add(/\b(for|while)\b/, 'What are you keeping track of as you go through the input?', 'iteration');
  add(/\bif\b|\?/, 'How do you decide when a value should be included in the result?', 'condition correctness');
  add(/\breturn\b|\bbreak\b/, 'How do you know when you can stop looking for a result?', 'stopping condition');
  add(/\bint\b|parseInt|Number\s*\(|stoi|isdigit/, 'Why do you convert the input into numbers before using it?', 'input conversion');
  const alternatives = [
    ['How does your solution handle the smallest allowed input?', 'boundary handling'],
    ['How do you decide what to include in the output?', 'output correctness'],
    ['What happens if the input contains repeated values?', 'duplicate handling'],
    ['What information do you need to keep while processing the input?', 'state tracking'],
    ['What happens if the input is already in the desired form?', 'boundary handling'],
    ['Which part of the solution does the most work as the input grows?', 'efficiency'],
  ];
  candidates.push(...alternatives.map(([question, focus]) => ({ question, focus })));
  const available = candidates.filter((candidate) => !history.some((entry) => entry.question.toLowerCase() === candidate.question.toLowerCase()));
  return available[0] || { question: `What is another input that would help you check your solution for question ${index + 1}?`, focus: 'correctness' };
};

module.exports = { codeQuestion, groundedQuestion };
