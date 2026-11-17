const { TOPICS, DIAGNOSTIC } = require('./curriculum');
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const problemId = (attempt) => String(attempt.problem?._id || attempt.problem);
const countsObject = (value) => value instanceof Map ? Object.fromEntries(value) : value || {};
const timestamp = (value) => new Date(value || 0).getTime() || 0;

function priorFor(topic, profile) {
  const answers = (profile?.diagnostic?.answers || []).filter((answer) => DIAGNOSTIC.find((question) => question.id === answer.questionId)?.topic === topic && answer.option != null);
  if (answers.length) return { score: 20 + 40 * answers.filter((answer) => answer.correct).length / answers.length, source: 'diagnostic' };
  const counts = (profile?.links || []).filter((link) => link.status === 'imported').map((link) => countsObject(link.topicCounts)).filter((counts) => Object.hasOwn(counts, topic));
  if (!counts.length) return { score: null, source: 'none' };
  const ratio = counts.reduce((sum, counts) => sum + Math.min(1, counts[topic] / Math.max(1, ...Object.values(counts))), 0) / counts.length;
  return { score: 20 + 40 * ratio, source: 'profile-estimate' };
}

function topicMap(profile, attempts) {
  return TOPICS.map((topic) => {
    const own = attempts.filter((attempt) => attempt.topic === topic.id);
    const grouped = new Map();
    for (const attempt of own.filter((item) => item.result)) {
      const key = problemId(attempt), group = grouped.get(key) || { solved: false, independent: false, latest: null };
      const accepted = attempt.result.status === 'accepted';
      group.solved ||= accepted;
      group.independent ||= accepted && !(attempt.hintsUsed?.length) && attempt.submissions <= 2;
      if (!group.latest || timestamp(attempt.updatedAt || attempt.startedAt) > timestamp(group.latest.updatedAt || group.latest.startedAt)) group.latest = attempt;
      grouped.set(key, group);
    }
    const groups = [...grouped.values()];
    const recent = groups.map((item) => item.latest).sort((a, b) => timestamp(a.updatedAt || a.startedAt) - timestamp(b.updatedAt || b.startedAt)).slice(-10);
    const prior = priorFor(topic.id, profile);
    let score = prior.score;
    if (recent.length) {
      const weighted = recent.reduce((sum, attempt, index) => {
        const accepted = attempt.result.status === 'accepted';
        let quality = accepted ? Math.max(40, 95 - (attempt.hintsUsed?.length || 0) * 12 - Math.max(0, attempt.submissions - 1) * 6) : 20 + 25 * ((attempt.result.passedCount || 0) / Math.max(1, attempt.result.totalCount || 0));
        return sum + quality * (index + 1);
      }, 0) / (recent.length * (recent.length + 1) / 2);
      score = recent.length < 3 && prior.score != null ? weighted * .7 + prior.score * .3 : weighted;
    }
    const solved = groups.filter((item) => item.solved).length, independent = groups.filter((item) => item.independent).length;
    let streak = 0;
    for (const attempt of [...recent].reverse()) { if (attempt.result.status !== 'accepted') break; streak++; }
    const status = score == null ? 'unassessed' : solved >= 3 && independent >= 2 && score >= 70 && streak >= 2 ? 'strong' : score >= 45 ? 'improving' : 'needs-practice';
    return { ...topic, score: score == null ? null : Math.round(score), status, confidence: groups.length >= 3 ? 'established' : groups.length ? 'developing' : score != null ? 'estimated' : 'unassessed', source: recent.length ? 'practice' : prior.source, uniqueSolved: solved, uniqueTried: groups.length, independentSolved: independent, attempts: own.length, submissions: own.reduce((sum, attempt) => sum + (attempt.submissions || 0), 0), lastPracticedAt: recent.at(-1)?.updatedAt || recent.at(-1)?.startedAt || null };
  });
}

function recommend(problems, topics, attempts, requestedTopic, random = Math.random, now = Date.now()) {
  const solved = new Set(attempts.filter((attempt) => attempt.result?.status === 'accepted').map(problemId));
  const lastUsed = new Map();
  for (const attempt of attempts) lastUsed.set(problemId(attempt), Math.max(lastUsed.get(problemId(attempt)) || 0, timestamp(attempt.updatedAt || attempt.startedAt)));
  const priority = { 'needs-practice': 0, unassessed: 1, improving: 2, strong: 3 };
  const sorted = [...topics].sort((a, b) => (a.id === requestedTopic ? -1 : b.id === requestedTopic ? 1 : priority[a.status] - priority[b.status] || (a.score ?? 0) - (b.score ?? 0) || timestamp(a.lastPracticedAt) - timestamp(b.lastPracticedAt)));
  const due = sorted.find((topic) => topic.status === 'strong' && now - timestamp(topic.lastPracticedAt) >= 7 * 86400000);
  if (!requestedTopic && due && random() < .2) sorted.unshift(sorted.splice(sorted.indexOf(due), 1)[0]);
  for (const topic of sorted) {
    const choices = problems.filter((problem) => problem.topic === topic.id && !solved.has(String(problem._id)));
    if (!choices.length) continue;
    const level = topic.status === 'strong' ? 2 : topic.uniqueSolved >= 2 ? 1 : 0;
    const distance = Math.min(...choices.map((problem) => Math.abs(DIFFICULTIES.indexOf(problem.difficulty) - level)));
    const suitable = choices.filter((problem) => Math.abs(DIFFICULTIES.indexOf(problem.difficulty) - level) === distance);
    const oldest = Math.min(...suitable.map((problem) => lastUsed.get(String(problem._id)) || 0));
    const pool = suitable.filter((problem) => (lastUsed.get(String(problem._id)) || 0) === oldest);
    const picked = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    return { problem: picked, kind: 'practice', reason: topic.status === 'unassessed' ? `A first look at ${topic.name.toLowerCase()}. We need evidence before judging this topic.` : topic.status === 'strong' ? `A new challenge to revisit ${topic.name.toLowerCase()}.` : `Build confidence in ${topic.name.toLowerCase()} with an unsolved ${picked.difficulty} problem.` };
  }
  const pool = [...problems].sort((a, b) => (lastUsed.get(String(a._id)) || 0) - (lastUsed.get(String(b._id)) || 0));
  return pool.length ? { problem: pool[0], kind: 'review', reason: 'You have solved the current question bank. Revisit a problem without hints; unique-solve totals will stay unchanged.' } : null;
}

module.exports = { topicMap, recommend, priorFor };
