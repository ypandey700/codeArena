const { comparableInterviewScores } = require('../services/interviewGrading');

const WEIGHTS = { correctness: 25, speed: 8, runtime: 7, timeComplexity: 12, spaceComplexity: 3, quality: 15, interview: 30 };
const EPS = Number(process.env.SCORE_TIE_EPSILON ?? 0.01);
const scoringInfo = (players) => {
  const keys = Object.keys(WEIGHTS).filter((key) => players.every((player) => Number.isFinite(player.scores?.[key])));
  const weight = keys.reduce((sum, key) => sum + WEIGHTS[key], 0);
  return { weights: WEIGHTS, activeWeights: Object.fromEntries(keys.map((key) => [key, WEIGHTS[key] / weight * 100])), drawThreshold: EPS, margin: Math.abs((players[0]?.scores?.total || 0) - (players[1]?.scores?.total || 0)) };
};
const COMPLEXITIES = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)', 'O(n^3)', 'O(2^n)', 'O(n!)'];
const clamp = (value) => Math.max(0, Math.min(100, value));
const complexityScore = (detected, optimal) => Math.max(0, 100 - 35 * Math.max(0, COMPLEXITIES.indexOf(detected) - COMPLEXITIES.indexOf(optimal)));

const computeResult = (battle) => {
  const players = battle.players;
  const available = players.every((p) => p.analysis);
  const interviewScores = comparableInterviewScores(players);
  const duration = battle.battleDurationMs || new Date(battle.endsAt) - new Date(battle.startedAt);
  const scores = players.map((p, index) => {
    const solved = p.totalTests > 0 && p.bestPassed === p.totalTests && !!p.solvedAt;
    const solveTime = solved ? new Date(p.solvedAt) - new Date(battle.startedAt) : 0;
    const s = {
      correctness: p.totalTests > 0 ? clamp(p.bestPassed / p.totalTests * 100) : 0,
      speed: solved ? clamp(Math.round(100 * (1 - solveTime / Math.max(1, duration)))) : 0,
      runtime: solved ? clamp(Math.round(100 * (1 - p.runtimeMs / battle.problem.timeLimitMs))) : 0,
      timeComplexity: available && COMPLEXITIES.includes(battle.problem.optimalTime) ? (p.bestPassed ? complexityScore(p.analysis.timeComplexity, battle.problem.optimalTime) : 0) : null,
      spaceComplexity: available && COMPLEXITIES.includes(battle.problem.optimalSpace) ? (p.bestPassed ? complexityScore(p.analysis.spaceComplexity, battle.problem.optimalSpace) : 0) : null,
      quality: available ? (p.bestPassed ? Math.round(Object.values(p.analysis.quality).reduce((a, b) => a + b, 0) / 4 * 10) : 0) : null,
      interview: interviewScores[index],
    };
    const keys = Object.keys(WEIGHTS).filter((key) => s[key] !== null);
    s.total = keys.reduce((sum, key) => sum + s[key] * WEIGHTS[key], 0) / keys.reduce((sum, key) => sum + WEIGHTS[key], 0);
    return s;
  });
  if (['forfeit', 'disconnect'].includes(battle.reason)) {
    return { scores, winner: battle.winner?._id || battle.winner, reason: battle.reason };
  }
  let difference = scores[0].total - scores[1].total;
  if (Math.abs(difference) < EPS || difference === 0) {
    difference = 0;
    for (const key of ['correctness', 'interview', 'speed', 'runtime']) {
      if (scores.some((score) => score[key] == null)) continue;
      difference = scores[0][key] - scores[1][key];
      if (difference) break;
    }
  }
  const winner = difference ? players[difference > 0 ? 0 : 1].user : null;
  return { scores, winner: winner?._id || winner, reason: winner ? 'time' : 'draw' };
};

module.exports = { WEIGHTS, COMPLEXITIES, computeResult, scoringInfo };
