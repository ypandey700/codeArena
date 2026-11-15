import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import api from "../services/api";

const scoreComponents = [
  ["correctness", "Correctness", 25], ["speed", "Speed", 8], ["runtime", "Runtime", 7],
  ["timeComplexity", "Time complexity", 12], ["spaceComplexity", "Space complexity", 3],
  ["quality", "Code quality", 15], ["interview", "Interview", 30], ["total", "Total", null],
];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const hasScore = (value) => typeof value === "number" && Number.isFinite(value);

function formatMs(ms) {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function PostMortemReport({ onBack, onReplay, onQueueNext }) {
  const frameRef = useRef(null);
  const { user } = useAuth();
  const { battleResult, setDuelState } = useBattle();
  const params = useParams();
  const navigate = useNavigate();
  const [battleData, setBattleData] = useState(null);
  const [loadError, setLoadError] = useState("");

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
      if (res.data?.data?.status === "finished" || res.data?.data?.status === "abandoned") setBattleData(res.data.data);
      else if (res.data?.data) setLoadError("This duel has not finished yet. Return to the battle room.");
      else setLoadError("No match report available.");
    }).catch(() => { if (mounted) setLoadError("Could not load this match report. Refresh to retry."); });
    return () => { mounted = false; };
  }, [battleResult, params.id]);

  function populateDoc(doc, data) {
    if (!doc || !data) return;

    const headerName = doc.getElementById("report-header-username");
    if (headerName) headerName.textContent = user?.username || "You";
    const headerTier = doc.getElementById("report-header-tier");
    if (headerTier) headerTier.textContent = user?.tier || "RANKED";
    const headerRating = doc.getElementById("report-header-rating");
    if (headerRating) headerRating.textContent = user?.rating != null ? `${user.rating} RR` : "—";
    const players = data.players || [];
    const myPlayer =
      players.find(
        (p) =>
          (user?._id && String(p.userId) === String(user._id)) ||
          p.username === user?.username
      ) || players.find((player) => Array.isArray(player.myTests)) || players[0];
    const oppPlayer = players.find((p) => p !== myPlayer) || players[1];

    const winner = data.winner;
    const reason = data.reason;
    const isWin = !!winner && String(winner) === String(myPlayer?.userId);
    const isDraw = reason === "draw" || !winner;

    const verdictText = isWin ? "VICTORY" : isDraw ? "DRAW" : "DEFEAT";
    const verdictEl = doc.getElementById("report-verdict");
    if (verdictEl) {
      verdictEl.textContent = verdictText;
      verdictEl.className = isWin
        ? "text-primary"
        : isDraw
        ? "text-amber-400"
        : "text-error";
    }

    const reasonEl = doc.getElementById("report-reason-badge");
    if (reasonEl) {
      const reasonMap = {
        solved: isWin ? "Problem Solved (All tests passed)" : "Opponent Solved Problem",
        forfeit: isWin ? "Opponent Forfeited" : "Forfeited",
        disconnect: isWin ? "Opponent Disconnected" : "Disconnected",
        timeout: "Time Expired",
        time: "Combined Score",
        draw: "Draw (Scores within 1 point)",
      };
      reasonEl.textContent = reasonMap[reason] || "Match Concluded";
    }

    const titleEl = doc.getElementById("report-problem-title");
    if (titleEl) {
      titleEl.textContent = data.problem?.title || "1v1 Duel Problem";
    }

    const tokenEl = doc.getElementById("report-session-token");
    if (tokenEl) {
      tokenEl.textContent = `#DUEL-${(data.battleId || "").slice(-8).toUpperCase()}`;
    }

    const myDelta = myPlayer?.ratingDelta;
    const myDeltaText =
      myDelta != null ? (myDelta >= 0 ? `+${myDelta} RR` : `${myDelta} RR`) : "—";
    const myNameEl = doc.getElementById("report-my-username");
    if (myNameEl) myNameEl.textContent = myPlayer?.username || user?.username || "You";
    const myBadgeEl = doc.getElementById("report-my-badge");
    if (myBadgeEl) {
      myBadgeEl.textContent = isWin ? "W" : isDraw ? "D" : "L";
      myBadgeEl.className = `absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
        isWin
          ? "bg-primary-container text-on-primary"
          : isDraw
          ? "bg-amber-400 text-black"
          : "bg-error text-white"
      }`;
    }
    const myStatsEl = doc.getElementById("report-my-stats");
    if (myStatsEl) {
      myStatsEl.textContent = `${myPlayer?.passedCount ?? "—"}/${myPlayer?.totalTests ?? "—"} Tests`;
    }
    const myDeltaEl = doc.getElementById("report-my-delta");
    if (myDeltaEl) myDeltaEl.innerHTML = `<span>${myDeltaText}</span>`;
    const myAfterEl = doc.getElementById("report-my-after");
    if (myAfterEl) {
      myAfterEl.textContent = `Now ${myPlayer?.ratingAfter ?? myPlayer?.ratingBefore ?? "—"} RR`;
    }
    const myXpEl = doc.getElementById("report-my-xp");
    if (myXpEl) myXpEl.textContent = myPlayer?.xpGained != null ? `+${myPlayer.xpGained} XP` : "—";

    const oppDelta = oppPlayer?.ratingDelta;
    const oppDeltaText =
      oppDelta != null ? (oppDelta >= 0 ? `+${oppDelta} RR` : `${oppDelta} RR`) : "—";
    const oppNameEl = doc.getElementById("report-opp-username");
    if (oppNameEl) oppNameEl.textContent = oppPlayer?.username || "Rival";
    const oppBadgeEl = doc.getElementById("report-opp-badge");
    if (oppBadgeEl) {
      oppBadgeEl.textContent = isWin ? "L" : isDraw ? "D" : "W";
      oppBadgeEl.className = `absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
        isWin
          ? "bg-error-container text-on-error-container"
          : isDraw
          ? "bg-amber-400 text-black"
          : "bg-primary-container text-on-primary"
      }`;
    }
    const oppStatsEl = doc.getElementById("report-opp-stats");
    if (oppStatsEl) {
      oppStatsEl.textContent = `${oppPlayer?.passedCount ?? "—"}/${oppPlayer?.totalTests ?? myPlayer?.totalTests ?? "—"} Tests`;
    }
    const oppDeltaEl = doc.getElementById("report-opp-delta");
    if (oppDeltaEl) oppDeltaEl.innerHTML = `<span>${oppDeltaText}</span>`;
    const oppAfterEl = doc.getElementById("report-opp-after");
    if (oppAfterEl) {
      oppAfterEl.textContent = `${oppPlayer?.ratingAfter ?? oppPlayer?.ratingBefore ?? "—"} RR`;
    }
    const oppXpEl = doc.getElementById("report-opp-xp");
    if (oppXpEl) oppXpEl.textContent = oppPlayer?.xpGained != null ? `+${oppPlayer.xpGained} XP` : "—";

    const timeDiffEl = doc.getElementById("report-time-diff");
    const timeDiffSubEl = doc.getElementById("report-time-diff-sub");
    if (timeDiffEl && timeDiffSubEl) {
      if (myPlayer?.solveTimeMs != null && oppPlayer?.solveTimeMs != null) {
        const diffSec = Math.round(
          Math.abs(myPlayer.solveTimeMs - oppPlayer.solveTimeMs) / 1000
        );
        const faster = myPlayer.solveTimeMs <= oppPlayer.solveTimeMs;
        timeDiffEl.textContent = `${diffSec}s ${faster ? "FASTER" : "SLOWER"}`;
        timeDiffSubEl.textContent = faster ? "YOU SOLVED FIRST" : "RIVAL SOLVED FIRST";
      } else if (myPlayer?.solveTimeMs != null) {
        timeDiffEl.textContent = formatMs(myPlayer.solveTimeMs);
        timeDiffSubEl.textContent = "SOLVE TIME";
      } else if (oppPlayer?.solveTimeMs != null) {
        timeDiffEl.textContent = formatMs(oppPlayer.solveTimeMs);
        timeDiffSubEl.textContent = "RIVAL SOLVE";
      } else {
        timeDiffEl.textContent = "—";
        timeDiffSubEl.textContent = "UNSOLVED";
      }
    }

    const velBadge = doc.getElementById("report-velocity-badge");
    if (velBadge) velBadge.textContent = myPlayer?.solveTimeMs != null ? "SOLVED" : "INCOMPLETE";
    const velMyName = doc.getElementById("report-velocity-my-name");
    if (velMyName) velMyName.textContent = myPlayer?.username || "You";
    const velMyVal = doc.getElementById("report-velocity-my-val");
    if (velMyVal) velMyVal.textContent = myPlayer?.solveTimeMs != null ? formatMs(myPlayer.solveTimeMs) : "—";
    const velOppName = doc.getElementById("report-velocity-opp-name");
    if (velOppName) velOppName.textContent = oppPlayer?.username || "Rival";
    const velOppVal = doc.getElementById("report-velocity-opp-val");
    if (velOppVal) velOppVal.textContent = oppPlayer?.solveTimeMs != null ? formatMs(oppPlayer.solveTimeMs) : "—";
    const velBarMy = doc.getElementById("report-velocity-bar-my");
    const velBarOpp = doc.getElementById("report-velocity-bar-opp");
    if (velBarMy && velBarOpp) {
      if (myPlayer?.solveTimeMs != null && oppPlayer?.solveTimeMs != null) {
        const total = myPlayer.solveTimeMs + oppPlayer.solveTimeMs || 1;
        const myP = Math.round((oppPlayer.solveTimeMs / total) * 100);
        velBarMy.style.width = `${myP}%`;
        velBarOpp.style.width = `${100 - myP}%`;
      } else if (myPlayer?.solveTimeMs != null) {
        velBarMy.style.width = "0%";
        velBarOpp.style.width = "0%";
      } else if (oppPlayer?.solveTimeMs != null) {
        velBarMy.style.width = "0%";
        velBarOpp.style.width = "0%";
      } else {
        velBarMy.style.width = "0%";
        velBarOpp.style.width = "0%";
      }
    }
    const velNote = doc.getElementById("report-velocity-note");
    if (velNote) {
      velNote.textContent =
        myPlayer?.solveTimeMs != null
          ? `Solve recorded at ${formatMs(myPlayer.solveTimeMs)}.`
          : "No complete solution submitted.";
    }

    const runBadge = doc.getElementById("report-runtime-badge");
    if (runBadge) runBadge.textContent = myPlayer?.runtimeMs != null ? `${myPlayer.runtimeMs}ms` : "—";
    const runMyName = doc.getElementById("report-runtime-my-name");
    if (runMyName) runMyName.textContent = myPlayer?.username || "You";
    const runMyVal = doc.getElementById("report-runtime-my-val");
    if (runMyVal) runMyVal.textContent = myPlayer?.runtimeMs != null ? `${myPlayer.runtimeMs}ms` : "—";
    const runOppName = doc.getElementById("report-runtime-opp-name");
    if (runOppName) runOppName.textContent = oppPlayer?.username || "Rival";
    const runOppVal = doc.getElementById("report-runtime-opp-val");
    if (runOppVal) runOppVal.textContent = oppPlayer?.runtimeMs != null ? `${oppPlayer.runtimeMs}ms` : "—";
    const runBarMy = doc.getElementById("report-runtime-bar-my");
    const runBarOpp = doc.getElementById("report-runtime-bar-opp");
    if (runBarMy && runBarOpp) {
      if (myPlayer?.runtimeMs != null && oppPlayer?.runtimeMs != null) {
        const total = myPlayer.runtimeMs + oppPlayer.runtimeMs || 1;
        const myP = Math.round((oppPlayer.runtimeMs / total) * 100);
        runBarMy.style.width = `${myP}%`;
        runBarOpp.style.width = `${100 - myP}%`;
      } else if (myPlayer?.runtimeMs != null) {
        runBarMy.style.width = "0%";
        runBarOpp.style.width = "0%";
      } else if (oppPlayer?.runtimeMs != null) {
        runBarMy.style.width = "0%";
        runBarOpp.style.width = "0%";
      } else {
        runBarMy.style.width = "0%";
        runBarOpp.style.width = "0%";
      }
    }
    const runNote = doc.getElementById("report-runtime-note");
    if (runNote) {
      runNote.textContent =
        myPlayer?.runtimeMs != null
          ? `Total test runtime: ${myPlayer.runtimeMs}ms.`
          : "No execution runtime recorded.";
    }

    const legMy = doc.getElementById("report-timeline-legend-my");
    if (legMy) {
      legMy.innerHTML = `<span class="w-3 h-1 bg-primary-container rounded"></span> You (${myPlayer?.passedCount ?? "—"}/${myPlayer?.totalTests ?? "—"})`;
    }
    const legOpp = doc.getElementById("report-timeline-legend-opp");
    if (legOpp) {
      legOpp.innerHTML = `<span class="w-3 h-1 bg-muted rounded border border-dashed border-muted"></span> ${escapeHtml(oppPlayer?.username || "Rival")} (${oppPlayer?.passedCount ?? "—"}/${oppPlayer?.totalTests ?? myPlayer?.totalTests ?? "—"})`;
    }

    const circuitStatus = doc.getElementById("report-circuit-status");
    if (circuitStatus) {
      circuitStatus.textContent = user?.rating != null ? `Current MMR: ${Number(user.rating).toLocaleString()} RR` : "Ranked Duel";
    }
    const tierBadge = doc.getElementById("report-tier-badge");
    if (tierBadge) {
      tierBadge.textContent = user?.tier || "RANKED";
    }

    const addFriendLabel = doc.getElementById("report-add-friend-label");
    if (addFriendLabel) {
      addFriendLabel.textContent = `Add ${oppPlayer?.username || "Friend"} (Soon)`;
    }

    renderScores(doc, data, myPlayer, oppPlayer);

    renderTimeline(
      doc,
      data.timeline || [],
      myPlayer?.userId || user?._id,
      myPlayer?.totalTests || 0
    );
  }

  function renderScores(doc, data, me, opponent) {
    const pair = [me, opponent];
    const names = ["You", opponent?.username || "Opponent"];
    const winnerClass = (player) => data.winner && String(data.winner) === String(player?.userId) ? "score-winner" : "";
    const setHtml = (id, html) => { const element = doc.getElementById(id); if (element) element.innerHTML = html; };
    ["my", "opp"].forEach((side, index) => {
      doc.getElementById(`report-${side}-card`)?.classList.toggle("score-winner", !!winnerClass(pair[index]));
    });
    setHtml("report-score-head", `<tr><th class="score-cell">Component</th><th class="score-cell">Weight</th>${pair.map((player, index) => `<th class="score-cell ${winnerClass(player)}">${escapeHtml(names[index])}${winnerClass(player) ? " · Winner" : ""}<span class="block text-xs text-muted mt-1">Finished: ${escapeHtml(player?.finishedBy || "unavailable")}</span></th>`).join("")}</tr>`);
    setHtml("report-score-rows", scoreComponents.map(([key, label, weight]) => `<tr><th class="score-cell ${key === "total" ? "text-primary-container" : "text-on-surface"}">${label}</th><td class="score-cell text-muted">${weight ?? "Renormalized"}</td>${pair.map((player, index) => {
      const value = player?.scores?.[key];
      return `<td class="score-cell ${winnerClass(player)}">${hasScore(value) ? `${value.toFixed(1)}<div class="score-track"><div class="score-fill ${index ? "opponent" : ""}" style="width:${Math.max(0, Math.min(100, value))}%"></div></div>` : '<span class="text-muted">pending</span>'}</td>`;
    }).join("")}</tr>`).join(""));
    const displayNumber = (value) => hasScore(value) ? String(value) : "pending";
    const interviewScore = (player) => player?.scores ? player.scores.interview : player?.interview?.score;
    setHtml("report-oral-defense", pair.map((player, index) => `<div class="flex justify-between gap-3"><span class="text-muted">${escapeHtml(names[index])}</span><span class="font-mono ${index ? "text-on-surface" : "text-primary-container"}">${displayNumber(interviewScore(player))}</span></div>`).join(""));
    setHtml("report-interview-summary", pair.map((player, index) => {
      const details = player?.interview;
      return `<div class="rounded-lg bg-surface-container-lowest p-4"><h4 class="text-primary-container">${escapeHtml(names[index])}</h4><p class="mt-3">Interview score: <span class="font-mono">${displayNumber(interviewScore(player))}</span></p><p class="mt-2">Understanding: ${displayNumber(details?.understanding)} / 10</p><p class="mt-2">Answered: ${Number.isInteger(details?.answered) ? details.answered : "pending"}/${Number.isInteger(details?.total) ? details.total : "pending"}</p></div>`;
    }).join(""));
    const transcript = Array.isArray(me?.interview?.perQuestion) ? me.interview.perQuestion : [];
    setHtml("report-interview-transcript", transcript.length ? `<table class="w-full text-left text-sm"><thead><tr><th class="score-cell">Question / Your answer</th><th class="score-cell">Accuracy / 10</th><th class="score-cell">Depth / 10</th><th class="score-cell">Clarity / 10</th></tr></thead><tbody>${transcript.map((entry) => `<tr class="border-t border-white/10"><td class="score-cell"><p class="text-primary-container">${escapeHtml(entry.question)}</p><p class="mt-3 whitespace-pre-wrap break-words text-on-surface-variant">${escapeHtml(entry.status === "skipped" ? "Skipped · 0 points" : entry.answer || "No answer provided.")}</p></td><td class="score-cell">${displayNumber(entry.accuracy)}</td><td class="score-cell">${displayNumber(entry.depth)}</td><td class="score-cell">${displayNumber(entry.clarity)}</td></tr>`).join("")}</tbody></table>` : '<p class="text-muted">No interview transcript available for this match.</p>');
    setHtml("report-interview-feedback", [ ["Strengths", me?.interview?.feedback?.strengths], ["Tips", me?.interview?.feedback?.tips] ].map(([label, values]) => {
      const entries = Array.isArray(values) ? values.filter((value) => typeof value === "string").slice(0, 3) : [];
      return entries.length ? `<div><h4 class="text-primary-container">${label}</h4><ul class="list-disc pl-5 mt-3 space-y-2 text-on-surface-variant">${entries.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div>` : "";
    }).join(""));
    const unavailable = pair.some((player) => player?.scores && ["timeComplexity", "spaceComplexity", "quality"].every((key) => player.scores[key] == null));
    const warning = doc.getElementById("report-analysis-unavailable");
    if (warning) warning.hidden = !unavailable;
    setHtml("report-complexity", pair.map((player, index) => `<div class="rounded-lg bg-surface-container-lowest p-4"><h4 class="text-primary-container mb-2">${escapeHtml(names[index])}</h4><p>Time — ${index ? "Opponent" : "You"}: ${escapeHtml(player?.timeComplexity || "pending")} / Optimal: ${escapeHtml(data.problem?.optimalTime || "unavailable")}</p><p class="mt-2">Space — ${index ? "Opponent" : "You"}: ${escapeHtml(player?.spaceComplexity || "pending")} / Optimal: ${escapeHtml(data.problem?.optimalSpace || "unavailable")}</p></div>`).join(""));
    const qualityHtml = pair.map((player, index) => {
      const tiles = ["naming", "readability", "maintainability", "idioms"].filter((key) => hasScore(player?.quality?.[key]));
      if (!tiles.length) return "";
      return `<div><h4 class="text-primary-container mb-3">${escapeHtml(names[index])}</h4><div class="grid grid-cols-2 gap-3">${tiles.map((key) => `<div class="p-4 rounded-lg bg-surface-container-lowest"><span class="capitalize text-muted">${key}</span><p class="font-mono text-xl text-on-surface mt-2">${player.quality[key]}<span class="text-sm text-muted"> / 10</span></p></div>`).join("")}</div></div>`;
    }).join("");
    setHtml("report-quality-tiles", qualityHtml);
    const qualitySection = doc.getElementById("report-quality");
    if (qualitySection) qualitySection.hidden = !qualityHtml;
    const tips = Array.isArray(me?.feedback) ? me.feedback.filter((tip) => typeof tip === "string").slice(0, 3) : [];
    setHtml("report-feedback-tips", tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join(""));
    const feedbackSection = doc.getElementById("report-feedback");
    if (feedbackSection) feedbackSection.hidden = !tips.length;
    const auto = doc.getElementById("report-auto-draft");
    if (auto) auto.hidden = me?.resultSource !== "auto_draft";
    const tests = Array.isArray(me?.myTests) ? me.myTests : [];
    const failures = tests.filter((test) => !test.passed);
    setHtml("report-mistakes", failures.length ? failures.map((test) => {
      const sample = Object.prototype.hasOwnProperty.call(test, "input") && Object.prototype.hasOwnProperty.call(test, "expected");
      const details = sample ? [ ["Input", test.input], ["Expected", test.expected], ["Actual", test.actual] ].map(([label, value]) => `<div class="mt-3"><p class="text-xs text-muted">${label}</p><pre class="p-3 mt-1 bg-surface-container rounded text-xs whitespace-pre-wrap break-words">${escapeHtml(value)}</pre></div>`).join("") : "";
      return `<article class="rounded-lg bg-surface-container-lowest p-4"><h4 class="text-primary-container">${sample ? "Sample" : "Hidden"} test ${escapeHtml(Number.isInteger(test.index) ? test.index + 1 : "")} · Failed</h4>${details}${test.error ? `<p class="mt-3 text-sm text-error whitespace-pre-wrap break-words">${escapeHtml(test.error)}</p>` : ""}</article>`;
    }).join("") : `<p class="text-muted">${tests.length ? "All recorded tests passed." : "No per-test details available."}</p>`);
    let savedCode;
    try { savedCode = JSON.parse(sessionStorage.getItem(`battle-code:${data.battleId}:${me?.userId}`)); } catch {}
    const finalCode = typeof data.myCode?.code === "string" ? data.myCode.code : typeof me?.finalCode === "string" ? me.finalCode : savedCode?.code;
    const codeElement = doc.getElementById("report-final-code");
    if (codeElement) codeElement.textContent = typeof finalCode === "string" ? finalCode || "No code saved." : "Final code unavailable in this browser.";
    const language = doc.getElementById("report-code-language");
    if (language) language.textContent = data.myCode?.language || me?.language || savedCode?.language || "";
    renderRadar(doc, pair);
  }

  function renderRadar(doc, players) {
    const axes = scoreComponents.slice(0, 6);
    const point = (index, value, radius = 95) => {
      const angle = index * Math.PI / 3 - Math.PI / 2;
      return [170 + Math.cos(angle) * radius * value / 100, 165 + Math.sin(angle) * radius * value / 100];
    };
    const coordinates = (index, value, radius) => point(index, value, radius).join(",");
    const grid = [25, 50, 75, 100].map((value) => `<polygon points="${axes.map((_, index) => coordinates(index, value)).join(" ")}" fill="none" stroke="#333535"/>`).join("");
    const labels = axes.map(([key, label], index) => {
      const [x, y] = point(index, 100, 135);
      const pending = players.some((player) => !hasScore(player?.scores?.[key]));
      return `<line x1="170" y1="165" x2="${point(index, 100)[0]}" y2="${point(index, 100)[1]}" stroke="#333535"/><text x="${x}" y="${y}" fill="#CEC6AE" text-anchor="middle" font-size="10">${label}${pending ? '<tspan x="'+x+'" dy="13" fill="#9A9A9A">pending</tspan>' : ""}</text>`;
    }).join("");
    const series = players.map((player, side) => {
      const color = side ? "#9A9A9A" : "#FDDF49";
      const known = axes.map(([key]) => hasScore(player?.scores?.[key]));
      const values = axes.map(([key]) => player?.scores?.[key]);
      const polygon = known.every(Boolean) ? `<polygon points="${values.map((value, index) => coordinates(index, value)).join(" ")}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="2"/>` : "";
      return polygon + axes.map(([key, label], index) => {
        if (!known[index]) return "";
        const [x, y] = point(index, values[index]);
        const next = (index + 1) % axes.length;
        const segment = !polygon && known[next] ? `<line x1="${x}" y1="${y}" x2="${point(next, values[next])[0]}" y2="${point(next, values[next])[1]}" stroke="${color}" stroke-width="2"/>` : "";
        return `${segment}<circle cx="${x}" cy="${y}" r="3" fill="${color}"><title>${side ? "Opponent" : "You"}: ${label} ${values[index].toFixed(1)}</title></circle>`;
      }).join("");
    }).join("");
    const chart = doc.getElementById("report-score-radar");
    if (chart) chart.innerHTML = `<svg viewBox="0 0 340 330" role="img" aria-label="Six-axis score comparison: correctness, speed, runtime, time complexity, space complexity and code quality" class="w-full">${grid}${labels}${series}</svg><p class="text-xs text-muted">Pending components have no plotted point.</p>`;
  }

  function renderTimeline(doc, timeline, myId, totalTests) {
    const myGroup = doc.getElementById("report-timeline-my-group");
    const oppGroup = doc.getElementById("report-timeline-opp-group");
    if (!myGroup || !oppGroup) return;

    myGroup.innerHTML = "";
    oppGroup.innerHTML = "";

    const myEvents = timeline.filter((e) => String(e.user) === String(myId));
    const oppEvents = timeline.filter((e) => String(e.user) !== String(myId));

    const allAts = timeline.map((e) => Number(e.at)).filter(Boolean);
    const minAt = allAts.length ? Math.min(...allAts) : 0;
    const maxAt = allAts.length ? Math.max(...allAts) : 1;
    const duration = Math.max(0, maxAt - minAt);
    const chart = doc.getElementById("report-timeline-container");
    if (chart) chart.hidden = !timeline.length;
    const summary = doc.getElementById("report-timeline-outcome");
    if (summary) summary.textContent = timeline.length ? `${timeline.length} recorded submissions` : "No submission timeline available";

    const tendEl = doc.getElementById("report-axis-tend");
    if (tendEl) tendEl.textContent = formatMs(duration);
    const tmidEl = doc.getElementById("report-axis-tmid");
    if (tmidEl) tmidEl.textContent = formatMs(duration / 2);
    const maxAxisEl = doc.getElementById("report-axis-max");
    if (maxAxisEl) maxAxisEl.textContent = `${totalTests} T`;

    const getX = (at) => 40 + Math.min(1, Math.max(0, (at - minAt) / (duration || 1))) * (680 - 40);
    const getY = (passed) => 210 - Math.min(1, Math.max(0, passed / (totalTests || 1))) * (210 - 30);

    if (myEvents.length > 0) {
      let d = `M 40 210`;
      let areaD = `M 40 210`;
      myEvents.forEach((ev) => {
        const x = getX(ev.at);
        const y = getY(ev.passedCount);
        d += ` L ${x} ${y}`;
        areaD += ` L ${x} ${y}`;
        const circle = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", String(x));
        circle.setAttribute("cy", String(y));
        circle.setAttribute("r", "4");
        circle.setAttribute("fill", "#FDDF49");
        myGroup.appendChild(circle);
      });
      const lastX = getX(myEvents[myEvents.length - 1].at);
      areaD += ` L ${lastX} 210 Z`;

      const areaPath = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      areaPath.setAttribute("d", areaD);
      areaPath.setAttribute("fill", "url(#youArea)");
      myGroup.prepend(areaPath);

      const linePath = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      linePath.setAttribute("d", d);
      linePath.setAttribute("fill", "none");
      linePath.setAttribute("stroke", "#FDDF49");
      linePath.setAttribute("stroke-width", "3");
      linePath.setAttribute("stroke-linecap", "round");
      myGroup.appendChild(linePath);
    }

    if (oppEvents.length > 0) {
      let d = `M 40 210`;
      oppEvents.forEach((ev) => {
        const x = getX(ev.at);
        const y = getY(ev.passedCount);
        d += ` L ${x} ${y}`;
        const circle = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", String(x));
        circle.setAttribute("cy", String(y));
        circle.setAttribute("r", "3");
        circle.setAttribute("fill", "#9A9A9A");
        oppGroup.appendChild(circle);
      });
      const linePath = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      linePath.setAttribute("d", d);
      linePath.setAttribute("fill", "none");
      linePath.setAttribute("stroke", "#9A9A9A");
      linePath.setAttribute("stroke-width", "2");
      linePath.setAttribute("stroke-dasharray", "5 5");
      oppGroup.appendChild(linePath);
    }
  }

  function connectReport() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    if (battleData) {
      populateDoc(doc, battleData);
    }

    doc.addEventListener("click", async (event) => {
      const button = event.target.closest("button, a");
      if (!button) return;
      if (button.disabled) {
        event.preventDefault();
        return;
      }
      const label = button.textContent.replace(/\s+/g, " ").trim();
      const id = button.id;
      if (id === "quick-queue-btn" || id === "main-queue-next" || /queue.*duel|queue.*next/i.test(label)) {
        event.preventDefault();
        setDuelState?.("closed");
        onQueueNext?.();
      } else if (button.dataset.path === "command-deck") {
        event.preventDefault();
        setDuelState?.("closed");
        if (onBack) onBack();
        navigate("/dashboard");
      } else if (button.dataset.path === "battle-modes") {
        event.preventDefault();
        setDuelState?.("closed");
        navigate("/battle-modes");
      }
    });

    doc.addEventListener("keydown", (event) => {
      if (/^(INPUT|TEXTAREA|BUTTON|A|SELECT)$/.test(event.target.tagName)) return;
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        setDuelState?.("closed");
        onQueueNext?.();
      }
    });
  }

  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc && battleData) {
      populateDoc(doc, battleData);
    }
  }, [battleData, user]);

  return (
    <>
    {!battleData && <p role="status" className="p-8 text-center text-[#FDDF49]">{loadError || "Loading match report…"}</p>}
    <iframe
      ref={frameRef}
      style={{ visibility: battleData ? "visible" : "hidden" }}
      src="/match-report.html"
      title="Match post-mortem and code quality report"
      onLoad={connectReport}
      className="block h-[calc(100dvh-64px)] w-full border-0 bg-[#121414]"
    />
    </>
  );
}
