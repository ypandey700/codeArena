const { codeTokens } = require('./starterCode');
const { analyzeCode } = require('./interviewQuestions');

const words = (text) => String(text || '').toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
const qualifies = (question) => {
  if (question.status !== 'answered' || !question.answer) return false;
  if (question.deadlineAt && question.answeredAt && new Date(question.answeredAt) > new Date(question.deadlineAt)) return false;
  const tokens = words(question.answer);
  const unique = new Set(tokens);
  const letters = question.answer.match(/\p{L}/gu)?.length || 0;
  const characters = question.answer.match(/\S/gu)?.length || 0;
  if (tokens.length < 5 || unique.size < 3 || letters / characters < 0.6 || unique.size / tokens.length < 0.4) return false;
  const prompt = new Set(words(question.text || question.question));
  const overlap = [...unique].filter((word) => prompt.has(word)).length;
  return overlap / new Set([...unique, ...prompt]).size <= 0.8;
};

const heuristicGrade = (questions, total, code, language) => {
  const identifiers = new Set();
  for (const [token] of codeTokens(code, language)) {
    if (!/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(token)) continue;
    for (const word of words(token)) identifiers.add(word);
    // Also recognize spoken forms such as "hash map" for HashMap.
    for (const word of token.replace(/([a-z\d])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s_$]+/)) {
      if (word.length > 1) identifiers.add(word);
    }
  }
  for (const { focus } of analyzeCode(String(code || ''), language).candidates) {
    if (!focus.includes(' ')) identifiers.add(focus);
  }
  const perQuestion = questions.slice(0, total).map((question) => {
    if (!qualifies(question)) return 0;
    const tokens = words(question.answer);
    return 2 + 1.5 * Math.min(tokens.length / 25, 1) + (tokens.some((word) => identifiers.has(word)) ? 1.5 : 0);
  });
  return { perQuestion, score: total > 0 ? perQuestion.reduce((sum, score) => sum + score, 0) / total * 10 : 0 };
};

const comparableInterviewScores = (players) => {
  const interviews = players.map((player) => player.interview);
  if (interviews.some((interview) => ['pending', 'active'].includes(interview?.status))) return players.map(() => null);
  const allLLM = interviews.every((interview) => interview?.gradeSource === 'llm' && Number.isFinite(interview.score));
  // A mixed battle uses the same heuristic for both totals. LLM feedback stays available for display.
  return interviews.map((interview) => {
    if (allLLM) return interview.score;
    if (Number.isFinite(interview?.heuristicScore)) return interview.heuristicScore;
    return interview?.gradeSource === 'heuristic' && Number.isFinite(interview.score) ? interview.score : 0;
  });
};

module.exports = { qualifies, heuristicGrade, comparableInterviewScores };
