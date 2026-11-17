export const METRICS = [
  { key: "correctness", label: "Correctness", detail: "Tests passed" },
  { key: "speed", label: "Solve speed", detail: "Time to a full solution" },
  { key: "runtime", label: "Runtime", detail: "Execution efficiency" },
  { key: "timeComplexity", label: "Time complexity", detail: "Algorithm efficiency" },
  { key: "spaceComplexity", label: "Space complexity", detail: "Memory efficiency" },
  { key: "quality", label: "Code quality", detail: "Clarity and maintainability" },
  { key: "interview", label: "Interview", detail: "Understanding your solution" },
];

export const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
export const formatNumber = (value, digits = 1) => isNumber(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
export const signed = (value, digits = 0) => isNumber(value) ? `${value > 0 ? "+" : ""}${formatNumber(value, digits)}` : "—";
export const boundedScore = (value) => isNumber(value) ? Math.max(0, Math.min(100, value)) : 0;
export const playerId = (player) => String(player?.userId ?? player?.user?._id ?? player?.user ?? "");

export function duration(ms) {
  if (!isNumber(ms) || ms < 0) return "Not solved";
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s` : `${formatNumber(ms / 1000)}s`;
}

export function resultOutcome(data, me) {
  if (data.status === "abandoned") return { key: "ended", label: "Match ended", line: "Another challenge awaits.", description: "This duel was abandoned. No winner was declared." };
  if (data.reason === "draw" || (!data.winner && data.status === "finished")) return { key: "draw", label: "Dead even.", line: "A rivalry worth another round.", description: isNumber(data.scoring?.drawThreshold) ? `Both players finished within the ${formatNumber(data.scoring.drawThreshold)}-point draw threshold.` : "This duel ended in a draw." };
  const won = String(data.winner) === playerId(me);
  const forced = ["forfeit", "disconnect"].includes(data.reason);
  const margin = data.scoring?.margin;
  const description = forced ? `${won ? "You won" : "Your rival won"} by ${data.reason === "forfeit" ? "forfeit" : "disconnection"}.` : isNumber(margin) ? `${won ? "You finished" : "Your rival finished"} ${formatNumber(margin, 2)} points ahead.` : "Your final duel result is in.";
  return won
    ? { key: "victory", label: "Victory.", line: "You earned this one.", description }
    : { key: "defeat", label: "Next time.", line: "Your next win starts here.", description };
}

export function metricDetail(key, player, problem) {
  if (key === "correctness") return isNumber(player.passedCount) && isNumber(player.totalTests) ? `${player.passedCount}/${player.totalTests} tests passed` : "Test count unavailable";
  if (key === "speed") return duration(player.solveTimeMs);
  if (key === "runtime") return isNumber(player.runtimeMs) && player.runtimeMs > 0 ? `${formatNumber(player.runtimeMs, 2)} ms` : "Runtime not measured";
  if (key === "timeComplexity" || key === "spaceComplexity") {
    const optimal = problem?.[key === "timeComplexity" ? "optimalTime" : "optimalSpace"];
    return player[key] ? `${player[key]}${optimal ? ` · target ${optimal}` : ""} · AI estimate` : "Analysis unavailable";
  }
  if (key === "quality") return isNumber(player.scores?.quality) ? "AI code assessment" : "Analysis unavailable";
  return isNumber(player.interview?.answered) && isNumber(player.interview?.total) ? `${player.interview.answered}/${player.interview.total} answered` : "Interview data unavailable";
}

export function biggestDifference(me, rival) {
  return METRICS.map((metric) => ({ ...metric, difference: isNumber(me.points?.[metric.key]) && isNumber(rival.points?.[metric.key]) ? me.points[metric.key] - rival.points[metric.key] : null }))
    .filter((metric) => isNumber(metric.difference) && Math.abs(metric.difference) > 0.005)
    .sort((left, right) => Math.abs(right.difference) - Math.abs(left.difference))[0] || null;
}

export function readOwnCode(data, me) {
  if (typeof data.myCode?.code === "string") return data.myCode;
  try {
    const saved = JSON.parse(sessionStorage.getItem(`battle-code:${data.battleId}:${playerId(me)}`));
    if (typeof saved?.code === "string") return saved;
  } catch {}
  return { code: null, language: "" };
}

export const LANGUAGES = { python: { label: "Python", file: "solution.py" }, javascript: { label: "JavaScript", file: "solution.js" }, cpp: { label: "C++", file: "solution.cpp" }, java: { label: "Java", file: "Main.java" } };
