import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import api from "../services/api";

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

  useEffect(() => {
    if (battleResult) {
      setBattleData(battleResult);
      return;
    }
    const id = params.id || localStorage.getItem("lastBattleId");
    if (!id) return;
    api
      .get(`/battles/${id}`)
      .then((res) => {
        if (res.data?.data) {
          setBattleData(res.data.data);
        }
      })
      .catch(() => {});
  }, [battleResult, params.id]);

  function populateDoc(doc, data) {
    if (!doc || !data) return;

    const players = data.players || [];
    const myPlayer =
      players.find(
        (p) =>
          (user?._id && String(p.userId) === String(user._id)) ||
          p.username === user?.username
      ) || players[0];
    const oppPlayer = players.find((p) => p !== myPlayer) || players[1];

    const winner = data.winner;
    const reason = data.reason;
    const isWin =
      winner &&
      (String(winner) === String(user?._id) ||
        (myPlayer && myPlayer.ratingDelta > 0));
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
        disconnected: isWin ? "Opponent Disconnected" : "Disconnected",
        timeout: "Time Expired",
        time: "Time Expired",
        draw: "Draw (Time Expired)",
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
      myDelta != null ? (myDelta >= 0 ? `+${myDelta} RR` : `${myDelta} RR`) : "+0 RR";
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
      myStatsEl.textContent = `${myPlayer?.passedCount ?? 0}/${myPlayer?.totalTests ?? 0} Tests`;
    }
    const myDeltaEl = doc.getElementById("report-my-delta");
    if (myDeltaEl) myDeltaEl.innerHTML = `<span>${myDeltaText}</span>`;
    const myAfterEl = doc.getElementById("report-my-after");
    if (myAfterEl) {
      myAfterEl.textContent = `Now ${myPlayer?.ratingAfter ?? myPlayer?.ratingBefore ?? 1200} RR`;
    }
    const myXpEl = doc.getElementById("report-my-xp");
    if (myXpEl) myXpEl.textContent = `+${myPlayer?.xpGained ?? 0} XP`;

    const oppDelta = oppPlayer?.ratingDelta;
    const oppDeltaText =
      oppDelta != null ? (oppDelta >= 0 ? `+${oppDelta} RR` : `${oppDelta} RR`) : "0 RR";
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
      oppStatsEl.textContent = `${oppPlayer?.passedCount ?? 0}/${oppPlayer?.totalTests ?? myPlayer?.totalTests ?? 0} Tests`;
    }
    const oppDeltaEl = doc.getElementById("report-opp-delta");
    if (oppDeltaEl) oppDeltaEl.innerHTML = `<span>${oppDeltaText}</span>`;
    const oppAfterEl = doc.getElementById("report-opp-after");
    if (oppAfterEl) {
      oppAfterEl.textContent = `${oppPlayer?.ratingAfter ?? oppPlayer?.ratingBefore ?? 1200} RR`;
    }
    const oppXpEl = doc.getElementById("report-opp-xp");
    if (oppXpEl) oppXpEl.textContent = `+${oppPlayer?.xpGained ?? 0} XP`;

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
        velBarMy.style.width = "100%";
        velBarOpp.style.width = "0%";
      } else if (oppPlayer?.solveTimeMs != null) {
        velBarMy.style.width = "0%";
        velBarOpp.style.width = "100%";
      } else {
        velBarMy.style.width = "50%";
        velBarOpp.style.width = "50%";
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
        runBarMy.style.width = "100%";
        runBarOpp.style.width = "0%";
      } else if (oppPlayer?.runtimeMs != null) {
        runBarMy.style.width = "0%";
        runBarOpp.style.width = "100%";
      } else {
        runBarMy.style.width = "50%";
        runBarOpp.style.width = "50%";
      }
    }
    const runNote = doc.getElementById("report-runtime-note");
    if (runNote) {
      runNote.textContent =
        myPlayer?.runtimeMs != null
          ? `Sandbox execution latency: ${myPlayer.runtimeMs}ms.`
          : "No execution runtime recorded.";
    }

    const legMy = doc.getElementById("report-timeline-legend-my");
    if (legMy) {
      legMy.innerHTML = `<span class="w-3 h-1 bg-primary-container rounded"></span> You (${myPlayer?.passedCount ?? 0}/${myPlayer?.totalTests ?? 0})`;
    }
    const legOpp = doc.getElementById("report-timeline-legend-opp");
    if (legOpp) {
      legOpp.innerHTML = `<span class="w-3 h-1 bg-muted rounded border border-dashed border-muted"></span> ${oppPlayer?.username || "Rival"} (${oppPlayer?.passedCount ?? 0}/${oppPlayer?.totalTests ?? myPlayer?.totalTests ?? 0})`;
    }

    const circuitStatus = doc.getElementById("report-circuit-status");
    if (circuitStatus) {
      circuitStatus.textContent = `Combat Streak: ${user?.stats?.streak ?? 0} • Current MMR: ${Number(user?.rating ?? 1200).toLocaleString()} RR`;
    }
    const tierBadge = doc.getElementById("report-tier-badge");
    if (tierBadge) {
      tierBadge.textContent = user?.tier || "RANKED";
    }

    const addFriendLabel = doc.getElementById("report-add-friend-label");
    if (addFriendLabel) {
      addFriendLabel.textContent = `Add ${oppPlayer?.username || "Friend"} (Soon)`;
    }

    renderTimeline(
      doc,
      data.timeline || [],
      myPlayer?.userId || user?._id,
      myPlayer?.totalTests || 15
    );
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
    const duration = Math.max(1000, maxAt - minAt);

    const tendEl = doc.getElementById("report-axis-tend");
    if (tendEl) tendEl.textContent = formatMs(duration);
    const tmidEl = doc.getElementById("report-axis-tmid");
    if (tmidEl) tmidEl.textContent = formatMs(duration / 2);
    const maxAxisEl = doc.getElementById("report-axis-max");
    if (maxAxisEl) maxAxisEl.textContent = `${totalTests} T`;

    const getX = (at) => 40 + Math.min(1, Math.max(0, (at - minAt) / duration)) * (680 - 40);
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
  }, [battleData]);

  return (
    <iframe
      ref={frameRef}
      src="/match-report.html"
      title="Match post-mortem and code quality report"
      onLoad={connectReport}
      className="block h-[calc(100dvh-64px)] w-full border-0 bg-[#121414]"
    />
  );
}
