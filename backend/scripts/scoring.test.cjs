const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { closeSync, mkdtempSync, openSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test, mock } = require('node:test');
const { computeResult, scoringInfo } = require('../src/config/scoring');
const { heuristicGrade } = require('../src/services/interviewGrading');
const { authoredCode, codeQuestion, groundedQuestion, uniqueQuestion } = require('../src/services/interviewQuestions');
const { isNoSubmission, starterCodeFor } = require('../src/services/starterCode');
const { problems } = require('../seeds/seedProblems');

const player = (user, overrides = {}) => ({
  user, bestPassed: 100, totalTests: 100, runtimeMs: 0, solvedAt: new Date(0),
  analysis: { timeComplexity: 'O(n)', spaceComplexity: 'O(1)', quality: { naming: 10, readability: 10, maintainability: 10, idioms: 10 } },
  interview: { status: 'done', score: 100, gradeSource: 'llm' },
  ...overrides,
});
const battle = (first, second) => ({
  startedAt: new Date(0), battleDurationMs: 100,
  problem: { timeLimitMs: 1000, optimalTime: 'O(n)', optimalSpace: 'O(1)' },
  players: [player('p1', first), player('p2', second)],
});
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} differs from ${expected}`);

test('compares unrounded totals with the configured epsilon', () => {
  const gradeForTotal = (total) => ({ status: 'done', gradeSource: 'llm', score: (total - 70) / 0.3 });
  const result = computeResult(battle({ interview: gradeForTotal(97.95) }, { interview: gradeForTotal(98.375) }));
  closeTo(result.scores[0].total, 97.95);
  closeTo(result.scores[1].total, 98.375);
  assert.equal(result.winner, 'p2');
  assert.equal(result.reason, 'time');
  assert.equal(scoringInfo([]).drawThreshold, Number(process.env.SCORE_TIE_EPSILON ?? 0.01));
});

test('equal totals use correctness, then interview; fully equal draws; forced results stand', () => {
  const llm = (score) => ({ status: 'done', gradeSource: 'llm', score });
  const correctnessTie = computeResult(battle(
    { bestPassed: 100, totalTests: 101, interview: llm(90) },
    { bestPassed: 99, totalTests: 101, interview: llm(90 + (100 / 101) * 25 / 30) }
  ));
  closeTo(correctnessTie.scores[0].total, correctnessTie.scores[1].total);
  assert.equal(correctnessTie.winner, 'p1');
  const interviewTie = computeResult(battle(
    { solvedAt: new Date(25), interview: llm(100) },
    { interview: llm(100 - 2 / 0.3) }
  ));
  closeTo(interviewTie.scores[0].total, interviewTie.scores[1].total);
  assert.equal(interviewTie.winner, 'p1');
  assert.equal(computeResult(battle()).reason, 'draw');
  assert.equal(computeResult(battle()).winner, null);
  for (const reason of ['forfeit', 'disconnect']) {
    const result = computeResult({ ...battle(undefined, { bestPassed: 0 }), winner: { _id: 'p2' }, reason });
    assert.equal(result.winner, 'p2');
    assert.equal(result.reason, reason);
  }
});

const prompt = 'Why does your solution store earlier values?';
const answered = (answer) => ({ text: prompt, answer, status: 'answered' });
const code = 'def solve(data):\n    seen = {}\n    for value in data:\n        if value in seen:\n            return value\n        seen[value] = True';

test('completed heuristic scores reward qualifying answers and keep interview weight', () => {
  const questions = [
    answered('The map records each value so future lookups avoid repeated scans.'),
    answered('The loop checks membership before inserting the current number.'),
    answered('Keeping seen values lets me detect the first repeated entry.'),
  ];
  const answerer = heuristicGrade(questions, 3, code, 'python').score;
  const skipper = heuristicGrade(questions.map((q) => ({ ...q, status: 'skipped' })), 3, code, 'python').score;
  assert.ok(answerer > 0 && answerer > skipper);
  assert.equal(skipper, 0);
  const match = battle({ interview: { status: 'done', gradeSource: 'heuristic', score: answerer } }, { interview: { status: 'done', gradeSource: 'heuristic', score: skipper } });
  const { scores } = computeResult(match);
  assert.deepEqual(scores.map((score) => score.interview), [answerer, 0]);
  assert.equal(scoringInfo(scores.map((score) => ({ scores: score }))).activeWeights.interview, 30);
  match.players[1].interview = { status: 'failed', score: null };
  assert.deepEqual(computeResult(match).scores.map((score) => score.interview), [answerer, 0]);
  match.players[1].interview = { status: 'active' };
  assert.deepEqual(computeResult(match).scores.map((score) => score.interview), [null, null]);
});

test('the heuristic rejects gibberish, copies and invalid statuses, and caps at 50', () => {
  for (const answer of ['asdf asdf asdf asdf asdf', 'a a a a a', '@!@!!?', prompt, 'x y z 1234 5678 ????', '']) {
    assert.equal(heuristicGrade([answered(answer)], 1, code, 'python').score, 0, answer);
  }
  const long = answered('The loop checks every incoming value against previously visited entries because retaining distinct keys allows a fast lookup and prevents falsely counting the current item twice.');
  assert.equal(heuristicGrade([long, long, long], 3, code, 'python').score, 50);
  assert.equal(heuristicGrade([{ ...long, status: 'expired' }], 1, code, 'python').score, 0);
  assert.equal(heuristicGrade([{ ...long, deadlineAt: new Date(0), answeredAt: new Date(1) }], 1, code, 'python').score, 0);
  const noCodeMatch = answered('Previously visited entries remain accessible during subsequent passes.');
  assert.ok(heuristicGrade([long], 1, '', 'python').score < 50);
  assert.ok(heuristicGrade([noCodeMatch], 1, code, 'python').score > 0);
});

test('mixed grading methods use both heuristic scores', () => {
  const { scores, winner } = computeResult(battle(
    { interview: { status: 'done', gradeSource: 'llm', score: 97, heuristicScore: 24 } },
    { interview: { status: 'done', gradeSource: 'heuristic', score: 39, heuristicScore: 39 } }
  ));
  assert.deepEqual(scores.map((score) => score.interview), [24, 39]);
  assert.equal(winner, 'p2');
});

const questionsForPlayers = (first, second, total) => {
  const asked = [];
  const byPlayer = [[], []];
  for (let index = 0; index < total; index++) {
    for (const [seat, source] of [first, second].entries()) {
      const question = codeQuestion(source, index, asked, { userId: `player-${seat}`, language: 'python', seat });
      assert.ok(question);
      assert.ok(source.includes(question.evidence));
      assert.ok(question.question.split(/\s+/).length <= 30);
      assert.ok(uniqueQuestion(question, asked));
      asked.push(question);
      byPlayer[seat].push(question.question);
    }
  }
  assert.notDeepEqual(...byPlayer);
  return byPlayer;
};

test('deterministic questions use the player’s own evidence and avoid sibling conflicts', () => {
  const different = 'def process(data):\n    return sorted(data)';
  questionsForPlayers(code, different, 4);
  assert.deepEqual(questionsForPlayers(code, code, 4), questionsForPlayers(code, code, 4));
  questionsForPlayers('print(1)', 'print(1)', 20);
  for (const [language, source] of [
    ['javascript', 'const ordered = data.sort();'], ['cpp', 'std::unordered_map<int, int> cache;'], ['java', 'Set<Integer> seen = new HashSet<>();'],
  ]) assert.ok(source.includes(codeQuestion(source, 0, [], { language }).evidence));
  const starter = starterCodeFor('two-sum').python;
  const submission = starter.replace('    pass', '    print(nums)');
  assert.equal(authoredCode(submission, 'python', starter).trim(), 'print(nums)');
  assert.equal(groundedQuestion({ question: 'Why did you define this function?', evidence: 'def solve():', focus: 'function' }, submission, 'python', starter), null);
  const llm = groundedQuestion({ question: 'Why do you need to repeat this operation?', evidence: 'for value in data:', focus: 'loop' }, code, 'python');
  assert.equal(llm.focus, 'loop');
  assert.equal(uniqueQuestion(llm, [{ text: 'What happens in each iteration?', focus: 'loop' }]), false);
});

const solvedReverse = String.raw`import sys

def solve():
    s = sys.stdin.read().rstrip('\r\n')
    print(s[::-1])

if __name__ == '__main__':
    solve()
`;
const staleProblem = { slug: 'reverse-string', starterCode: { python: solvedReverse }, hiddenTestCases: [{ input: 'secret' }] };

test('exact legacy solutions and unchanged stubs are no submissions', () => {
  assert.ok(isNoSubmission(staleProblem, 'python', solvedReverse));
  assert.ok(isNoSubmission(staleProblem, 'python', solvedReverse.replace('import sys', 'import    sys # comment')));
  assert.equal(isNoSubmission(staleProblem, 'python', solvedReverse.replaceAll(/\bs\b/g, 'text')), false);
  assert.ok(isNoSubmission(staleProblem, 'python', '   '));
  for (const problem of problems) {
    for (const [language, stub] of Object.entries(problem.starterCode)) {
      const comment = language === 'python' ? '# Intentional comment' : '/* Intentional comment */';
      assert.ok(isNoSubmission(problem, language, stub));
      assert.ok(isNoSubmission(problem, language, `\n${comment}\n${stub}\n`));
    }
  }
});

test('battle and problem detail sanitize stale records without database access', async () => {
  // battleService normally opens Redis when imported. Model calls below are mocked as well.
  require.cache[require.resolve('../src/config/redis')] = { exports: {} };
  const { cleanProblem } = require('../src/services/battleService');
  const { getProblemBySlug } = require('../src/controllers/problemController');
  const Problem = require('../src/models/Problem');
  const clean = cleanProblem(staleProblem);
  assert.equal(clean.starterCode.python, starterCodeFor(staleProblem.slug).python);
  assert.equal(clean.hiddenTestCases, undefined);
  assert.equal(staleProblem.starterCode.python, solvedReverse);
  const find = mock.method(Problem, 'findOne', () => ({ select: async () => ({ slug: staleProblem.slug, starterCode: staleProblem.starterCode }) }));
  try {
    const response = await getProblemBySlug({ params: { slug: staleProblem.slug } }, { json: (value) => value, status: (code) => assert.fail(`Unexpected HTTP ${code}`) });
    assert.equal(response.data.problem.starterCode.python, starterCodeFor(staleProblem.slug).python);
  } finally {
    find.mock.restore();
  }
});

test('the battle result serializer keeps internal grading and evidence private', async () => {
  require.cache[require.resolve('../src/config/redis')] = { exports: {} };
  const { formatBattleEndShape } = require('../src/services/battleService');
  const Battle = require('../src/models/Battle');
  const Interview = require('../src/models/Interview');
  const match = { ...battle(), _id: 'battle', status: 'finished' };
  match.players[0].language = 'python';
  match.players[0].finalCode = solvedReverse;
  const result = computeResult(match);
  match.players.forEach((entry, index) => { entry.scores = result.scores[index]; entry.record = {}; });
  const query = { select: () => query, sort: () => query, lean: async () => [] };
  const findBattles = mock.method(Battle, 'find', () => query);
  const findInterviews = mock.method(Interview, 'find', async () => [{
    user: 'p1', status: 'done', source: 'fallback', gradeSource: 'heuristic', heuristicScore: 45, score: 45,
    total: 1, understanding: 0, feedback: { strengths: [], tips: [] },
    questions: [{ text: prompt, status: 'answered', answer: 'answer', accuracy: 4, depth: 4, clarity: 4, evidence: 'private fragment', type: 'storage' }],
  }]);
  try {
    const payload = await formatBattleEndShape(match, 'p1');
    assert.deepEqual(Object.keys(payload).sort(), ['battleId', 'status', 'scoring', 'headToHead', 'myCode', 'winner', 'reason', 'problem', 'players', 'timeline'].sort());
    assert.deepEqual(Object.keys(payload.players[0].interview).sort(), ['score', 'understanding', 'answered', 'total', 'source', 'perQuestion', 'feedback'].sort());
    assert.deepEqual(Object.keys(payload.players[0].interview.perQuestion[0]).sort(), ['question', 'answer', 'status', 'accuracy', 'depth', 'clarity'].sort());
    assert.deepEqual(payload.myCode, { language: 'python', code: '' });
    assert.doesNotMatch(JSON.stringify(payload), /gradeSource|heuristicScore|private fragment/);
  } finally {
    findBattles.mock.restore();
    findInterviews.mock.restore();
  }
});

test('an expired interview finishes with a numeric heuristic grade', async () => {
  require.cache[require.resolve('../src/config/redis')] = { exports: {} };
  const Interview = require('../src/models/Interview');
  const Battle = require('../src/models/Battle');
  const service = require('../src/services/interviewService');
  const interview = {
    _id: 'interview', battle: 'battle', user: 'p1', status: 'active', revision: 0, deadlineAt: new Date(0), total: 2,
    questions: [answered('A map keeps each value available for the membership check.'), { text: 'What would you test?', status: 'open', answer: '' }],
  };
  const activeBattle = { _id: 'battle', status: 'active', problem: { slug: 'two-sum' }, players: [{ user: 'p1', phase: 'interview', finalCode: code, language: 'python' }] };
  const battleQuery = { ...activeBattle, select: () => battleQuery, populate: async () => activeBattle };
  const findBattle = mock.method(Battle, 'findOne', () => battleQuery);
  const findInterview = mock.method(Interview, 'findById', async () => interview);
  const updateInterview = mock.method(Interview, 'findOneAndUpdate', async (filter, update) => {
    if (filter.revision !== undefined) assert.equal(filter.revision, interview.revision);
    Object.assign(interview, update.$set);
    interview.revision += update.$inc?.revision || 0;
    return interview;
  });
  try {
    await service.start(interview._id);
    assert.equal(interview.status, 'done');
    assert.equal(interview.gradeSource, 'heuristic');
    assert.ok(interview.score > 0);
    assert.equal(interview.questions[1].status, 'expired');
    assert.equal(interview.questions[1].accuracy, 0);
  } finally {
    findBattle.mock.restore();
    findInterview.mock.restore();
    updateInterview.mock.restore();
  }
});

test('all 16 Python/JavaScript stubs run and do not solve the sample inputs', () => {
  const temp = mkdtempSync(join(tmpdir(), 'arena-starters-'));
  const inputFile = join(temp, 'stdin.txt');
  try {
    for (const problem of problems) {
      for (const [language, executable] of [['python', process.env.PYTHON || 'python3'], ['javascript', process.execPath]]) {
        const stub = problem.starterCode[language];
        for (const { input, expectedOutput } of problem.sampleTestCases) {
          writeFileSync(inputFile, input);
          const stdin = openSync(inputFile, 'r');
          try {
            const result = spawnSync(executable, [language === 'python' ? '-c' : '-e', stub], { stdio: [stdin, 'pipe', 'pipe'], encoding: 'utf8', timeout: 3000 });
            assert.ifError(result.error);
            assert.equal(result.status, 0, result.stderr);
            assert.notEqual(result.stdout.trim(), expectedOutput.trim(), `${problem.slug} ${language}`);
          } finally {
            closeSync(stdin);
          }
        }
      }
    }
  } finally {
    rmSync(temp, { recursive: true });
  }
});
