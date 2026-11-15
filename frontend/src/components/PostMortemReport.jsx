import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import api from "../services/api";

const components = [
  ["correctness", "Tests passed"], ["speed", "Solve time"], ["runtime", "Runtime"],
  ["timeComplexity", "Time complexity"], ["spaceComplexity", "Space complexity"],
  ["quality", "Code quality"], ["interview", "Interview"],
];
const tiers = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const numeric = (value) => typeof value === "number" && Number.isFinite(value);
const number = (value, digits = 1) => numeric(value) ? value.toFixed(digits) : "—";
const rounded = (value, digits = 1) => numeric(value) ? Number(value.toFixed(digits)) : null;
const signed = (value) => numeric(value) ? `${value >= 0 ? "+" : ""}${value}` : "—";
const pending = (reason) => `<span class="pending">pending<small>${escapeHtml(reason)}</small></span>`;
const scoreBar = (value, side) => numeric(value) ? `<span class="score-value mono">${number(value)}<small style="display:inline"> / 100</small></span><div class="track"><div class="fill ${side ? "rival" : ""}" style="width:${Math.max(0, Math.min(100, value))}%"></div></div>` : "";

function compare(left, right, { lower = false, unit = "", digits = 1, ratio = false, reason = "Value unavailable", neutral = false } = {}) {
  if (!numeric(left) || !numeric(right)) return { side: null, text: `— · ${reason}` };
  if (left === right) return { side: null, text: "= tie" };
  if (neutral) return { side: null, text: "— · match count" };
  const side = (lower ? left < right : left > right) ? 0 : 1;
  const name = side ? "Rival" : "You";
  const minimum = Math.min(left, right);
  const delta = Math.abs(left - right);
  const deltaDigits = rounded(delta, digits) === 0 ? Math.min(6, digits + 2) : digits;
  const text = ratio && minimum > 0 ? `${name} ${number(Math.max(left, right) / minimum)}x faster` : `${name} +${number(delta, deltaDigits)}${unit}${lower && ["s", "ms"].includes(unit) ? " faster" : ""}`;
  return { side, text };
}

const valueCell = (content, side, comparison) => `<td data-label="${side ? "Rival" : "You"}" class="${comparison.side === side ? "better" : ""}">${content}${comparison.side === side ? '<span class="marker" aria-label="Better">◆</span>' : ""}</td>`;
const edgeCell = (comparison) => `<td data-label="Edge" class="edge ${comparison.side !== null ? "better" : "muted"}">${escapeHtml(comparison.text)}</td>`;
const comparisonRow = (label, values, displays, options) => {
  const comparison = compare(values[0], values[1], options);
  return `<tr><th scope="row">${escapeHtml(label)}</th>${displays.map((display, side) => valueCell(display, side, comparison)).join("")}${edgeCell(comparison)}</tr>`;
};
const playerName = (player, side) => `${side ? "Rival" : "You"} · ${player?.username || "Username unavailable"}`;
const comparisonHead = (players) => `<tr><th scope="col">Metric</th>${players.map((player, side) => `<th scope="col">${escapeHtml(playerName(player, side))}</th>`).join("")}<th scope="col">Edge</th></tr>`;

function renderRadar(players) {
  const axes = components.filter(([key]) => players.every((player) => numeric(player.scores?.[key])));
  if (!axes.length) return '<p class="muted">No shared scored axes available. AI analysis or interview scoring may be unavailable.</p>';
  const point = (index, value, radius = 135) => {
    const angle = index * Math.PI * 2 / axes.length - Math.PI / 2;
    return [250 + Math.cos(angle) * radius * value / 100, 205 + Math.sin(angle) * radius * value / 100];
  };
  const grid = [25, 50, 75, 100].map((value) => `<polygon points="${axes.map((_, index) => point(index, value).join(",")).join(" ")}" fill="none" stroke="#363939"/>`).join("");
  const labels = axes.map(([key, label], index) => {
    const end = point(index, 100);
    const position = point(index, 100, 174);
    return `<line x1="250" y1="205" x2="${end[0]}" y2="${end[1]}" stroke="#363939"/><text x="${position[0]}" y="${position[1]}" text-anchor="middle" fill="#CEC6AE" font-size="11">${escapeHtml(key === "correctness" ? "Correctness" : key === "speed" ? "Speed" : label)}</text>`;
  }).join("");
  const series = players.map((player, side) => {
    const color = side ? "#aeb7c4" : "#FDDF49";
    const points = axes.map(([key], index) => point(index, player.scores[key]).join(",")).join(" ");
    return `<polygon points="${points}" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="2" ${side ? 'stroke-dasharray="5 4"' : ""}/>${axes.map(([key, label], index) => {
      const [x, y] = point(index, player.scores[key]);
      return `<circle cx="${x}" cy="${y}" r="3" fill="${color}"><title>${escapeHtml(playerName(player, side))}: ${escapeHtml(label)} ${number(player.scores[key])}</title></circle>`;
    }).join("")}`;
  }).join("");
  const skipped = components.filter(([key]) => !axes.some(([active]) => active === key)).map(([, label]) => label);
  return `<svg class="chart" viewBox="0 0 500 410" role="img" aria-label="Both players on ${axes.length} shared score axes, out of 100">${grid}${labels}${series}</svg><p class="muted">${skipped.length ? `Pending axes omitted for both: ${escapeHtml(skipped.join(", "))}.` : "All seven scored axes shown. Each axis is out of 100."}</p>`;
}

function renderTimeline(data, players) {
  const events = (data.timeline || []).filter((event) => players.some((player) => String(player.userId) === String(event.user)) && numeric(event.at) && numeric(event.passedCount)).sort((a, b) => a.at - b.at);
  if (!events.length) return '<p class="muted">No submission timeline available.</p>';
  const first = events[0].at;
  const duration = events[events.length - 1].at - first;
  const maximum = Math.max(...players.map((player) => numeric(player.totalTests) ? player.totalTests : 0), ...events.map((event) => event.passedCount), 1);
  const x = (at) => 50 + (at - first) / (duration || 1) * 650;
  const y = (passed) => 220 - passed / maximum * 180;
  const grid = [0, 0.5, 1].map((fraction) => `<line x1="50" y1="${y(fraction * maximum)}" x2="700" y2="${y(fraction * maximum)}" stroke="#363939"/><text x="40" y="${y(fraction * maximum) + 4}" text-anchor="end" fill="#9A9A9A" font-size="11">${number(fraction * maximum, 0)}</text>`).join("");
  const series = players.map((player, side) => {
    const own = events.filter((event) => String(event.user) === String(player.userId));
    const color = side ? "#aeb7c4" : "#FDDF49";
    return `<polyline points="${own.map((event) => `${x(event.at)},${y(event.passedCount)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2" ${side ? 'stroke-dasharray="5 4"' : ""}/>${own.map((event) => `<circle cx="${x(event.at)}" cy="${y(event.passedCount)}" r="4" fill="${color}"><title>${escapeHtml(playerName(player, side))}: ${event.passedCount} tests, ${number((event.at - first) / 1000)}s since first submission</title></circle>`).join("")}`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 750 260" role="img" aria-label="Tests passed over time for both players">${grid}${series}<text x="50" y="248" fill="#9A9A9A" font-size="11">0.0s</text><text x="700" y="248" text-anchor="end" fill="#9A9A9A" font-size="11">${number(duration / 1000)}s</text></svg><p class="muted">Tests passed · Time since first recorded submission. ${events.length} recorded submissions. ${players.filter((player) => !events.some((event) => String(event.user) === String(player.userId))).map((player) => `${escapeHtml(player.username)} has no recorded submissions.`).join(" ")}</p>`;
}

function populateDoc(doc, data, players) {
  const [me, rival] = players;
  const setHtml = (id, html) => { const element = doc.getElementById(id); if (element) element.innerHTML = html; };
  const setText = (id, text) => { const element = doc.getElementById(id); if (element) element.textContent = text; };
  const draw = data.reason === "draw" || (!data.winner && data.status === "finished");
  const mine = String(data.winner) === String(me.userId);
  const verdict = draw ? "DRAW" : data.winner ? mine ? "VICTORY" : "DEFEAT" : "MATCH ENDED";
  const totals = players.map((player) => player.scores?.total);
  const margin = data.scoring?.margin;
  const forced = ["forfeit", "disconnect"].includes(data.reason);
  const winningName = mine ? "You" : "Rival";
  let explanation = "— · Result numbers unavailable";
  if (forced) explanation = `${winningName} won by ${data.reason}.`;
  else if (draw && totals.every(numeric) && numeric(margin) && numeric(data.scoring?.drawThreshold)) explanation = `Draw: ${number(totals[0])} vs ${number(totals[1])} (${number(margin)} apart, under the ${number(data.scoring.drawThreshold)} threshold)`;
  else if (data.winner && numeric(margin)) explanation = `${winningName} won by ${number(margin)} points.`;
  if (data.status === "abandoned") explanation = "Match abandoned · No winner declared.";
  setText("report-verdict", verdict);
  setText("report-reason", explanation);
  setText("report-problem-title", data.problem?.title || "Problem title unavailable");
  setText("report-session-token", `#DUEL-${String(data.battleId || "").slice(-8).toUpperCase()}`);
  const cards = players.map((player, side) => {
    const winner = data.winner && String(player.userId) === String(data.winner);
    let avatar = `<span class="avatar" aria-hidden="true">${escapeHtml(player.username?.slice(0, 1).toUpperCase() || "?")}</span>`;
    try {
      const url = new URL(player.avatar, window.location.origin);
      if (player.avatar && ["http:", "https:"].includes(url.protocol)) avatar = `<img class="avatar" src="${escapeHtml(url.href)}" alt="${escapeHtml(player.username)} avatar" referrerpolicy="no-referrer">`;
    } catch {}
    return `<article class="player-card ${winner ? "winner" : ""}"><div class="identity">${avatar}<div><span class="eyebrow">${side ? "Rival" : "You"}</span><h3>${escapeHtml(player.username || "Username unavailable")}</h3></div></div><span class="badge">${escapeHtml(player.record?.tier || "Tier unavailable")}</span><span class="badge">Rank ${numeric(player.record?.rank) ? `#${player.record.rank}` : "—"}</span><p class="mono">${number(player.ratingBefore, 0)} → ${number(player.ratingAfter, 0)} RR <span class="better">(${signed(player.ratingDelta)})</span></p><p class="mono">${numeric(player.xpGained) ? `${signed(player.xpGained)} XP` : "— · XP unavailable"}</p><span class="badge">${draw ? "Draw" : winner ? "Winner" : data.winner ? "Defeat" : "No verdict"}</span><small>Finished: ${escapeHtml(player.finishedBy || "unavailable")}</small></article>`;
  });
  setHtml("report-hero", `${cards[0]}<div class="versus"><span class="vs">VS</span><strong class="mono">${number(totals[0])} vs ${number(totals[1])}</strong><small>${number(margin)} points apart${forced ? " · outcome by " + escapeHtml(data.reason) : ""}</small></div>${cards[1]}`);
  setHtml("report-record-head", comparisonHead(players));
  setText("report-record-note", players.map((player, side) => `${side ? "Rival" : "You"}: ${player.record ? player.record.isCurrent ? "current record" : "includes this match" : "record unavailable"}`).join(" · "));
  const recordRows = [
    ["rating", "Rating"], ["tier", "Tier"], ["rank", "Rank", true], ["wins", "Record W-L-D"],
    ["winRate", "Win rate"], ["streak", "Win streak"], ["peakRating", "Peak rating"], ["matches", "Matches"],
  ].map(([key, label, lower]) => {
    const values = players.map((player) => key === "tier" ? tiers.includes(player.record?.tier) ? tiers.indexOf(player.record.tier) : null : player.record?.[key]);
    const displays = players.map((player) => {
      const record = player.record;
      if (key === "tier") return escapeHtml(record?.tier || "— · Tier unavailable");
      if (key === "wins") return record && [record.wins, record.losses, record.draws].every(numeric) ? `${record.wins}-${record.losses}-${record.draws}<small>Wins · Losses · Draws</small>` : "— · Record unavailable";
      return numeric(record?.[key]) ? `${key === "rank" ? "#" : ""}${record[key]}${key === "winRate" ? "%" : ""}` : "— · Record unavailable";
    });
    return comparisonRow(label, values, displays, { lower, digits: 0, unit: key === "winRate" ? " pp" : key === "tier" ? " tiers" : key === "rank" ? " places" : key === "wins" ? " wins" : "", neutral: key === "matches", reason: "Record unavailable" });
  });
  setHtml("report-record-rows", recordRows.join(""));
  const history = data.headToHead;
  setHtml("report-head-to-head", history && [history.total, history.wins, history.losses, history.draws].every(numeric) ? `<p class="mono">You ${history.wins} - ${history.losses} - ${history.draws} Rival (${history.total} ${history.total === 1 ? "match" : "matches"})</p><small>You wins · Rival wins · Draws${history.total === 1 ? " · First meeting" : ""}</small><div class="dots" aria-label="Your latest results, newest first">${(history.last || []).filter((value) => ["W", "L", "D"].includes(value)).map((value) => `<span class="dot ${value}" title="${value === "W" ? "You won" : value === "L" ? "You lost" : "Draw"}">${value}</span>`).join("")}</div><small>Latest results from your perspective · newest first</small>` : '<p class="muted">— · Head-to-head unavailable</p>');
  setHtml("report-matrix-head", `<tr><th scope="col">Component</th><th scope="col">Weight</th>${players.map((player, side) => `<th scope="col">${escapeHtml(playerName(player, side))}</th>`).join("")}<th scope="col">Edge</th></tr>`);
  const matrix = components.map(([key, label]) => {
    const scores = players.map((player) => player.scores?.[key]);
    const seconds = players.map((player) => numeric(player.solveTimeMs) ? rounded(player.solveTimeMs / 1000) : null);
    const runtimes = players.map((player) => numeric(player.runtimeMs) && player.runtimeMs > 0 ? rounded(player.runtimeMs) : null);
    const values = key === "speed" ? seconds : key === "runtime" ? runtimes : key === "correctness" ? players.map((player) => player.passedCount) : scores;
    const reason = key === "speed" ? "One or both players unsolved" : key === "runtime" ? "Runtime not measured" : key === "interview" ? "Interview not scored" : ["quality", "timeComplexity", "spaceComplexity"].includes(key) ? "AI analysis unavailable" : "Score unavailable";
    const comparable = scores.every(numeric);
    const edge = compare(...(comparable ? values : [null, null]), { lower: ["speed", "runtime"].includes(key), unit: key === "speed" ? "s" : key === "runtime" ? "ms" : key === "correctness" ? " tests" : " pts", digits: key === "correctness" ? 0 : 1, ratio: key === "runtime", reason });
    const weight = data.scoring?.activeWeights?.[key];
    const nominal = data.scoring?.weights?.[key];
    const weightHtml = numeric(weight) ? `${number(weight)}%${numeric(nominal) && Math.abs(weight - nominal) > 0.001 ? `<small>${number(nominal)}% nominal</small>` : ""}` : `—<small>${numeric(nominal) ? `${number(nominal)}% nominal · inactive` : "Weight unavailable"}</small>`;
    const cells = players.map((player, side) => {
      let raw = "";
      if (key === "correctness") raw = `${number(player.passedCount, 0)}/${number(player.totalTests, 0)} tests`;
      else if (key === "speed") raw = numeric(seconds[side]) ? `${number(seconds[side])}s` : "— · Unsolved";
      else if (key === "runtime") raw = numeric(runtimes[side]) ? `${number(runtimes[side])}ms` : "— · Runtime not measured";
      else if (["timeComplexity", "spaceComplexity"].includes(key)) raw = `${player[key] || "pending"} vs ${data.problem?.[key === "timeComplexity" ? "optimalTime" : "optimalSpace"] || "optimal unavailable"} · AI estimate`;
      else if (key === "quality") raw = numeric(scores[side]) ? `${number(scores[side])}/100 · AI estimate` : "AI analysis unavailable";
      else raw = `${number(player.interview?.score)}/100 · ${number(player.interview?.answered, 0)}/${number(player.interview?.total, 0)} answered`;
      const points = player.points?.[key];
      return valueCell(`${numeric(scores[side]) ? scoreBar(scores[side], side) : pending(reason)}<small class="mono">${escapeHtml(raw)}</small><small class="mono">${numeric(points) ? `${number(points, 2)} points contributed` : "— · No scored contribution"}</small>`, side, edge);
    }).join("");
    return `<tr><th scope="row">${label}</th><td>${weightHtml}</td>${cells}${edgeCell(edge)}</tr>`;
  });
  const totalEdge = compare(...totals, { unit: " pts" });
  matrix.push(`<tr class="total"><th scope="row">Total</th><td>${Object.keys(data.scoring?.activeWeights || {}).length ? "100%" : "—"}</td>${players.map((player, side) => valueCell(`${numeric(totals[side]) ? scoreBar(totals[side], side) : pending("Total unavailable")}<small class="mono">${number(totals[side], 2)} total points</small>`, side, totalEdge)).join("")}${edgeCell(totalEdge)}</tr>`);
  setHtml("report-matrix-rows", matrix.join(""));
  const legend = players.map((player, side) => `<span>${escapeHtml(playerName(player, side))}</span>`).join("");
  setHtml("report-radar-legend", legend);
  setHtml("report-timeline-legend", legend);
  setHtml("report-score-radar", renderRadar(players));
  setHtml("report-timeline", renderTimeline(data, players));
  setHtml("report-quality-head", comparisonHead(players));
  const qualityRows = ["naming", "readability", "maintainability", "idioms"].map((key) => {
    const values = players.map((player) => player.quality?.[key]);
    return comparisonRow(key[0].toUpperCase() + key.slice(1), values, values.map((value) => numeric(value) ? `${number(value)} / 10` : pending("AI analysis unavailable")), { unit: " / 10", reason: "AI analysis unavailable" });
  });
  [ ["score", "Interview score"], ["understanding", "Understanding"], ["answered", "Interview answered"] ].forEach(([key, label]) => {
    const values = players.map((player) => key === "score" ? player.scores?.interview : player.interview?.[key]);
    qualityRows.push(comparisonRow(label, values, values.map((value, side) => numeric(value) ? `${number(value, key === "answered" ? 0 : 1)} / ${key === "answered" ? number(players[side].interview?.total, 0) : key === "understanding" ? "10" : "100"}` : pending("Interview not scored")), { unit: key === "answered" ? " answers" : " pts", digits: key === "answered" ? 0 : 1, reason: "Interview not scored" }));
  });
  setHtml("report-quality-rows", qualityRows.join(""));
  const transcript = Array.isArray(me.interview?.perQuestion) ? me.interview.perQuestion : [];
  setHtml("report-interview-transcript", transcript.length ? `<table class="transcript"><thead><tr><th>Question / My answer</th><th>Accuracy / 10</th><th>Depth / 10</th><th>Clarity / 10</th></tr></thead><tbody>${transcript.map((entry) => `<tr><td><p class="better">${escapeHtml(entry.question)}</p><p>${escapeHtml(entry.status === "skipped" ? "Skipped" : entry.answer || "No answer provided.")}</p><small>${escapeHtml(entry.status || "")}</small></td>${["accuracy", "depth", "clarity"].map((key) => `<td class="mono">${number(entry[key])}</td>`).join("")}</tr>`).join("")}</tbody></table>` : '<p class="muted">— · No interview transcript available for this match.</p>');
  setHtml("report-interview-feedback", [ ["My interview strengths", me.interview?.feedback?.strengths], ["My interview tips", me.interview?.feedback?.tips] ].map(([label, values]) => {
    const entries = Array.isArray(values) ? values.filter((value) => typeof value === "string") : [];
    return `<div><h3>${label}</h3>${entries.length ? `<ul>${entries.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>` : '<p class="muted">— · Interview feedback unavailable</p>'}</div>`;
  }).join(""));
  const auto = doc.getElementById("report-auto-draft");
  if (auto) auto.hidden = me.resultSource !== "auto_draft";
  const tests = Array.isArray(me.myTests) ? me.myTests : [];
  const failures = tests.filter((test) => !test.passed);
  setHtml("report-mistakes", failures.length ? failures.map((test) => {
    const sample = Object.prototype.hasOwnProperty.call(test, "input") && Object.prototype.hasOwnProperty.call(test, "expected");
    const details = sample ? [ ["Input", test.input], ["Expected", test.expected], ["Actual", test.actual] ].map(([label, value]) => `<small>${label}</small><pre>${escapeHtml(value)}</pre>`).join("") : "";
    return `<article class="mistake"><strong>${sample ? "Sample" : "Hidden"} test ${numeric(test.index) ? test.index + 1 : ""} · Failed</strong>${details}${test.error ? `<p>${escapeHtml(test.error)}</p>` : ""}</article>`;
  }).join("") : `<p class="muted">${tests.length ? "All recorded tests passed." : "— · No per-test details available."}</p>`);
  let savedCode;
  try { savedCode = JSON.parse(sessionStorage.getItem(`battle-code:${data.battleId}:${me.userId}`)); } catch {}
  const finalCode = typeof data.myCode?.code === "string" ? data.myCode.code : savedCode?.code;
  setText("report-final-code", typeof finalCode === "string" ? finalCode || "No code saved." : "Final code unavailable in this browser.");
  setText("report-code-language", data.myCode?.language || savedCode?.language || "Language unavailable");
  const tips = Array.isArray(me.feedback) ? me.feedback.filter((value) => typeof value === "string") : [];
  setHtml("report-feedback-tips", tips.length ? `<ul>${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul>` : '<p class="muted">— · Code-analysis tips unavailable.</p>');
}

export default function PostMortemReport({ onBack, onQueueNext }) {
  const frameRef = useRef(null);
  const { user } = useAuth();
  const { battleResult, setDuelState } = useBattle();
  const params = useParams();
  const navigate = useNavigate();
  const [battleData, setBattleData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [frameReady, setFrameReady] = useState(false);
  const userId = user?._id || user?.id;
  const me = userId && battleData?.players?.find((player) => String(player.userId) === String(userId));
  const rival = me && battleData.players.find((player) => String(player.userId) !== String(userId));

  useEffect(() => {
    let mounted = true;
    setLoadError("");
    if (battleResult && (!params.id || String(params.id) === String(battleResult.battleId))) {
      setBattleData(battleResult);
      return;
    }
    setBattleData(null);
    const id = params.id || localStorage.getItem("lastBattleId");
    if (!id) { setLoadError("No match report available."); return; }
    api.get(`/battles/${id}`).then((res) => {
      if (!mounted) return;
      const data = res.data?.data;
      if (["finished", "abandoned"].includes(data?.status)) setBattleData(data);
      else setLoadError(data ? "This duel has not finished yet. Return to the battle room." : "No match report available.");
    }).catch(() => { if (mounted) setLoadError("Could not load this match report. Refresh to retry."); });
    return () => { mounted = false; };
  }, [battleResult, params.id]);

  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (frameReady && doc && battleData && me && rival) populateDoc(doc, battleData, [me, rival]);
  }, [frameReady, battleData, me, rival]);

  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!frameReady || !doc) return;
    const queue = () => { setDuelState?.("closed"); onQueueNext?.(); };
    const click = (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.id === "main-queue-next") queue();
      else if (button.dataset.path === "command-deck") {
        setDuelState?.("closed");
        if (onBack) onBack();
        else navigate("/dashboard");
      }
    };
    const keydown = (event) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|BUTTON|A|SELECT|PRE)$/.test(event.target.tagName)) return;
      if (event.code === "Enter") { event.preventDefault(); queue(); }
    };
    doc.addEventListener("click", click);
    doc.addEventListener("keydown", keydown);
    return () => { doc.removeEventListener("click", click); doc.removeEventListener("keydown", keydown); };
  }, [frameReady, setDuelState, onQueueNext, onBack, navigate]);

  const ready = !!(battleData && me && rival);
  const error = loadError || (battleData && userId && !ready ? "The logged-in player could not be matched to both result participants." : "");
  return (
    <>
      {!ready && <p role="status" className="p-8 text-center text-[#FDDF49]">{error || "Loading match report…"}</p>}
      <iframe ref={frameRef} style={{ visibility: ready ? "visible" : "hidden" }} src="/match-report.html" title="Match post-mortem and player comparison" onLoad={() => setFrameReady(true)} className="block h-[calc(100dvh-64px)] w-full border-0 bg-[#121414]" />
    </>
  );
}
