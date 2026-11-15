import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBattle, toTimestamp } from "../context/BattleContext";
import AIInterview from "../pages/AIInterview";
import api from "../services/api";

const defaultTemplates = [
`class Solution:
    def solve(self, *args):
        pass`,
`function solve(...args) {
  // your solution here
}`,
`#include <iostream>
using namespace std;

int main() {
    return 0;
}`,
`public class Solution {
    public static void main(String[] args) {
    }
}`,
];

const langKeys = ["python", "javascript", "cpp", "java"];
const langLabels = ["Python 3.11", "JavaScript", "C++ 20", "Java 21"];
const langExts = ["py", "js", "cpp", "java"];

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function BattleArena({ onExit, onQueueNext, onReport }) {
  const { user } = useAuth();
  const {
    activeBattle,
    chatMessages,
    sendChatMessage,
    opponentProgress,
    submissionResult,
    submitBattleCode,
    saveCodeDraft,
    finishBattle,
    forfeitBattle,
    opponentDisconnected,
    timeOffset,
    interview,
  } = useBattle();

  const frameRef = useRef(null);
  const [concede, setConcede] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [popup, setPopup] = useState(null);
  const [selectedCase, setSelectedCase] = useState(0);
  const popupRef = useRef(null);

  const codeByLangRef = useRef({
    python: "",
    javascript: "",
    cpp: "",
    java: "",
  });
  const currentLangRef = useRef("python");
  const draftTimerRef = useRef(null);
  const lastDraftAtRef = useRef(0);
  const draftVersionRef = useRef(0);
  const dirtyRef = useRef(false);
  const liveRef = useRef({});

  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [execution, setExecution] = useState(null);
  const [executionError, setExecutionError] = useState("");

  const [disconnectCountdown, setDisconnectCountdown] = useState(null);
  const unreadCountRef = useRef(0);
  const prevMessagesCountRef = useRef(0);

  const problem = activeBattle?.problem;
  const opponent = activeBattle?.opponent;
  const totalTests =
    opponentProgress?.totalCount ||
    submissionResult?.totalCount ||
    activeBattle?.players?.find((p) => p.totalTests > 0)?.totalTests ||
    activeBattle?.ownProgress?.totalTests ||
    activeBattle?.opponentProgress?.totalTests ||
    problem?.sampleTestCases?.length || 0;

  const calculateRemainingSeconds = () => {
    if (!activeBattle?.endsAt) return 0;
    const now = Date.now() + (timeOffset || 0);
    const end = toTimestamp(activeBattle.endsAt);
    if (!end) return 0;
    return Math.max(0, Math.floor((end - now) / 1000));
  };

  const [remainingTime, setRemainingTime] = useState(calculateRemainingSeconds);
  const ownFinished = !!activeBattle?.ownFinished || ["interview", "done"].includes(activeBattle?.myPhase);
  const finalizing = activeBattle?.status === "finalizing";
  const locked = ownFinished || finalizing || finishing || remainingTime <= 0;
  liveRef.current = { battle: activeBattle, ownFinished, finalizing, finishing, remainingTime, userId: user?._id };

  const persistEditor = () => {
    const { battle, userId } = liveRef.current;
    if (!battle?.battleId) return;
    try {
      sessionStorage.setItem(`battle-editor:${battle.battleId}:${userId}`, JSON.stringify({ language: currentLangRef.current, codes: codeByLangRef.current }));
    } catch {}
  };

  const syncEditorState = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const state = liveRef.current;
    const disabled = state.ownFinished || state.finalizing || state.finishing || state.remainingTime <= 0 || busyRef.current;
    const editor = doc.getElementById("battle-code-editor");
    if (editor) editor.readOnly = disabled;
    for (const id of ["submit-duel-btn", "run-local-tests-btn", "finish-duel-btn", "reset-code-btn"]) {
      const button = doc.getElementById(id);
      if (button) button.disabled = disabled;
    }
    doc.querySelectorAll(".lang-tab").forEach((tab) => { tab.disabled = disabled; });
  };

  const publishDraft = async (force = false) => {
    clearTimeout(draftTimerRef.current);
    const state = liveRef.current;
    if (!state.battle || state.ownFinished || state.finalizing || state.remainingTime <= 0) return false;
    if (!force && !dirtyRef.current) return true;
    const language = currentLangRef.current;
    const code = codeByLangRef.current[language];
    if (typeof code !== "string") return false;
    const version = draftVersionRef.current;
    lastDraftAtRef.current = Date.now();
    try {
      await saveCodeDraft({ language, code });
      if (draftVersionRef.current === version) dirtyRef.current = false;
      setDraftError("");
      if (dirtyRef.current) scheduleDraft();
      return true;
    } catch (error) {
      if (!liveRef.current.ownFinished && !liveRef.current.finalizing) {
        setDraftError(error.message);
        if (dirtyRef.current) scheduleDraft();
      }
      return false;
    }
  };

  const scheduleDraft = (force = false) => {
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => { publishDraft(force); }, force ? 0 : Math.max(0, 5000 - (Date.now() - lastDraftAtRef.current)));
  };

  const editorChanged = () => {
    dirtyRef.current = true;
    draftVersionRef.current++;
    persistEditor();
    scheduleDraft();
  };

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") publishDraft(true);
    };
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      clearTimeout(draftTimerRef.current);
    };
  }, [activeBattle?.battleId]);

  useEffect(() => {
    syncEditorState();
    if (ownFinished || finalizing) {
      clearTimeout(draftTimerRef.current);
      setPopup(null);
      setConfirmFinish(false);
    }
  }, [ownFinished, finalizing, finishing, busy, remainingTime]);

  useEffect(() => {
    if (!problem || !activeBattle?.battleId) return;
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(`battle-editor:${activeBattle.battleId}:${user?._id}`)); } catch {}
    langKeys.forEach((lang, idx) => {
      codeByLangRef.current[lang] = saved?.codes?.[lang] ?? problem.starterCode?.[lang] ?? defaultTemplates[idx];
    });
    currentLangRef.current = langKeys.includes(saved?.language) ? saved.language : "python";
    dirtyRef.current = false;
    const doc = frameRef.current?.contentDocument;
    const editor = doc?.getElementById("battle-code-editor");
    if (editor) editor.value = codeByLangRef.current[currentLangRef.current];
    doc?.querySelectorAll(".lang-tab").forEach((tab, index) => {
      tab.className = index === langKeys.indexOf(currentLangRef.current) ? "lang-tab px-2.5 py-0.5 rounded bg-surface-container-high text-primary-container font-caption text-[11px]" : "lang-tab px-2.5 py-0.5 rounded text-muted hover:text-on-surface font-caption text-[11px]";
    });
    syncEditorState();
  }, [activeBattle?.battleId, problem?.slug, user?._id]);

  useEffect(() => {
    const tick = () => {
      const rem = calculateRemainingSeconds();
      setRemainingTime(rem);
      const doc = frameRef.current?.contentDocument;
      if (doc) {
        const timerEl = doc.getElementById("duel-timer");
        if (timerEl) {
          const m = String(Math.floor(rem / 60)).padStart(2, "0");
          const s = String(rem % 60).padStart(2, "0");
          timerEl.textContent = `${m}:${s}`;
        }
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeBattle?.endsAt, timeOffset]);

  useEffect(() => {
    if (!opponentDisconnected) {
      setDisconnectCountdown(null);
      return;
    }
    const initial = opponentDisconnected.graceSeconds || 30;
    setDisconnectCountdown(initial);
    const interval = setInterval(() => {
      setDisconnectCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [opponentDisconnected]);

  const updateHudAndTelemetry = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    const hTier = doc.getElementById("header-player-tier");
    if (hTier) hTier.textContent = user?.tier || "RANKED";
    const hRating = doc.getElementById("header-player-rating");
    if (hRating) hRating.textContent = `${user?.rating ?? "—"} RR`;
    const hUser = doc.getElementById("header-player-username");
    if (hUser) hUser.textContent = user?.username || "You";
    const hAvatar = doc.getElementById("header-player-avatar");
    if (hAvatar && user?.avatar) {
      hAvatar.innerHTML = `<img src="${user.avatar}" alt="" class="h-full w-full object-cover rounded-full" />`;
    }

    const myAvatar = doc.getElementById("hud-my-avatar");
    if (myAvatar && user?.avatar) {
      myAvatar.innerHTML = `<img src="${user.avatar}" alt="" class="h-full w-full object-cover rounded" />`;
    }
    const myTier = doc.getElementById("hud-my-tier");
    if (myTier) myTier.textContent = user?.tier || "RANKED";
    const myRating = doc.getElementById("hud-my-rating");
    if (myRating) myRating.textContent = `${user?.rating ?? "—"} RR`;

    const stakesWin = doc.getElementById("hud-stakes-win");
    if (stakesWin) {
      const winVal = activeBattle?.ratingPreview?.win;
      stakesWin.textContent = winVal != null ? `+${winVal} RR` : "Scored result";
    }
    const stakesLoss = doc.getElementById("hud-stakes-loss");
    if (stakesLoss) {
      const lossVal = activeBattle?.ratingPreview?.loss;
      stakesLoss.textContent = lossVal != null ? `${lossVal} RR` : "Pending";
    }

    const oppUser = doc.getElementById("hud-opp-username");
    if (oppUser) oppUser.textContent = opponent?.username || "Challenger";
    const oppTier = doc.getElementById("hud-opp-tier");
    if (oppTier) oppTier.textContent = opponent?.tier || "RANKED";
    const oppRating = doc.getElementById("hud-opp-rating");
    if (oppRating) oppRating.textContent = `${opponent?.rating ?? "—"} RR`;
    const oppAvatar = doc.getElementById("hud-opp-avatar");
    if (oppAvatar && opponent?.avatar) {
      oppAvatar.innerHTML = `<img src="${opponent.avatar}" alt="" class="h-full w-full object-cover rounded" />`;
    }

    const myPassed = submissionResult?.passedCount ?? (activeBattle?.ownProgress?.bestPassed || 0);
    const oppPassed = opponentProgress?.passedCount ?? (activeBattle?.opponentProgress?.bestPassed || 0);
    const myPct = totalTests > 0 ? Math.min(100, Math.max(0, Math.round((myPassed / totalTests) * 100))) : 0;
    const oppPct = totalTests > 0 ? Math.min(100, Math.max(0, Math.round((oppPassed / totalTests) * 100))) : 0;

    const myProgBar = doc.getElementById("hud-my-progress-bar");
    if (myProgBar) myProgBar.style.width = `${myPct}%`;
    const myProgText = doc.getElementById("hud-my-progress-text");
    if (myProgText) myProgText.innerHTML = `${myPassed}<span class="text-muted font-normal">/${totalTests}</span>`;

    const oppProgBar = doc.getElementById("hud-opp-progress-bar");
    if (oppProgBar) oppProgBar.style.width = `${oppPct}%`;
    const oppProgText = doc.getElementById("hud-opp-progress-text");
    if (oppProgText) oppProgText.innerHTML = `${oppPassed}<span class="text-muted font-normal">/${totalTests}</span>`;

    const chatOppName = doc.getElementById("chat-opp-name");
    if (chatOppName) chatOppName.textContent = opponent?.username || "Challenger";
    const chatTriggerSub = doc.getElementById("chat-trigger-sub");
    if (chatTriggerSub) chatTriggerSub.textContent = `vs ${opponent?.username || "Challenger"}`;

    const problemTitle = doc.getElementById("problem-title");
    if (problemTitle && problem?.title) {
      problemTitle.textContent = problem.title;
      problemTitle.setAttribute("title", problem.title);
    }

    const diffBadge = doc.getElementById("problem-difficulty-badge");
    if (diffBadge && problem?.difficulty) {
      diffBadge.textContent = problem.difficulty.toUpperCase();
      if (problem.difficulty === "easy") {
        diffBadge.className = "px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-400 border border-emerald-400/30 font-caption text-[10px] font-bold flex-shrink-0";
      } else if (problem.difficulty === "medium") {
        diffBadge.className = "px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400 border border-amber-400/30 font-caption text-[10px] font-bold flex-shrink-0";
      } else {
        diffBadge.className = "px-1.5 py-0.5 rounded bg-rose-400/20 text-rose-400 border border-rose-400/30 font-caption text-[10px] font-bold flex-shrink-0";
      }
    }

    const descContainer = doc.getElementById("tab-content-desc");
    if (descContainer && problem?.description) {
      descContainer.innerHTML = `<div class="text-on-surface-variant text-[13px] leading-relaxed whitespace-pre-wrap">${escapeHtml(problem.description)}</div>`;
    }

    const constraintsContainer = doc.getElementById("tab-content-constraints");
    if (constraintsContainer && problem?.constraints) {
      constraintsContainer.innerHTML = `<div class="p-2.5 rounded bg-surface-container space-y-1.5 border border-white/[0.04] text-[11px] text-secondary whitespace-pre-wrap">${escapeHtml(problem.constraints)}</div>`;
    }
  };

  const updateChatStream = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const chatStream = doc.getElementById("chat-stream");
    const chatModal = doc.getElementById("floating-chat-modal");
    const chatBadge = doc.getElementById("chat-unread-badge");
    if (!chatStream) return;

    const isClosed = !chatModal?.classList.contains("open");
    if (chatMessages.length > prevMessagesCountRef.current) {
      const newMsgs = chatMessages.slice(prevMessagesCountRef.current);
      newMsgs.forEach((m) => {
        if (m.from !== user?.username && isClosed) {
          unreadCountRef.current += 1;
        }
      });
      if (isClosed && unreadCountRef.current > 0 && chatBadge) {
        chatBadge.textContent = String(unreadCountRef.current);
        chatBadge.classList.remove("hidden");
      }
    }
    prevMessagesCountRef.current = chatMessages.length;

    const oppPassed = opponentProgress?.passedCount ?? (activeBattle?.opponentProgress?.bestPassed || 0);

    let html = `
      <div class="text-center my-0.5">
        <span class="px-2 py-0.5 rounded-full bg-surface-container text-muted font-mono text-[10px] inline-block border border-white/[0.04]">
          ⚡ Duel initialized • 1v1 Battle Mode
        </span>
      </div>
    `;

    if (oppPassed > 0) {
      html += `
        <div class="p-1.5 rounded bg-surface-container-lowest text-surface-tint font-mono text-[10px] flex items-center gap-1.5 border border-white/[0.04]">
          <span class="material-symbols-outlined text-[14px] text-primary-container">bolt</span>
          <span>${escapeHtml(opponent?.username || "Opponent")} passed <strong>${oppPassed}/${totalTests} tests</strong></span>
        </div>
      `;
    }

    chatMessages.forEach((msg) => {
      const date = msg.at ? new Date(msg.at) : new Date();
      const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      const safeText = escapeHtml(msg.text);

      if (msg.isSystem) {
        html += `
          <div class="p-1.5 rounded bg-error/20 text-error font-mono text-[10px] text-center border border-error/30">
            ${safeText}
          </div>
        `;
      } else if (msg.from === user?.username || msg.from === "You") {
        html += `
          <div class="flex flex-col items-end space-y-0.5">
            <div class="flex items-center gap-1.5 text-muted text-[10px] font-mono">
              <span>${timeStr}</span>
              <span class="text-primary-container font-semibold">You</span>
            </div>
            <div class="p-2 rounded-lg rounded-tr-none bg-primary-container text-on-primary font-semibold text-xs max-w-[85%] shadow-sm">
              ${safeText}
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="flex flex-col items-start space-y-0.5">
            <div class="flex items-center gap-1.5 text-muted text-[10px] font-mono">
              <span class="text-secondary font-semibold">${escapeHtml(msg.from)}</span>
              <span>${timeStr}</span>
            </div>
            <div class="p-2 rounded-lg rounded-tl-none bg-surface-container text-on-surface text-xs max-w-[85%] border border-white/[0.04]">
              ${safeText}
            </div>
          </div>
        `;
      }
    });

    chatStream.innerHTML = html;
    chatStream.scrollTop = chatStream.scrollHeight;
  };

  useEffect(() => {
    updateHudAndTelemetry();
  }, [submissionResult, opponentProgress, activeBattle, user, totalTests]);

  useEffect(() => {
    updateChatStream();
  }, [chatMessages, opponentProgress]);

  async function execute(submit = false) {
    const state = liveRef.current;
    if (busyRef.current || state.ownFinished || state.finalizing || state.finishing || state.remainingTime <= 0) return;
    busyRef.current = true;
    setBusy(true);
    setExecution(null);
    setExecutionError("");
    setPopup("run");

    const doc = frameRef.current?.contentDocument;
    const runBtn = doc?.getElementById("run-local-tests-btn");
    const submitBtn = doc?.getElementById("submit-duel-btn");

    if (runBtn) runBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;

    if (submit && submitBtn) {
      const span = submitBtn.querySelector("span:last-child");
      if (span) span.textContent = "Running…";
    } else if (!submit && runBtn) {
      const span = runBtn.querySelector("span");
      if (span) span.textContent = "Running…";
    }

    try {
      const language = currentLangRef.current;
      const code = codeByLangRef.current[language] || doc?.getElementById("battle-code-editor")?.value || "";

      if (submit) {
        const res = await submitBattleCode({ language, code });
        setExecution(res?.data || res);
      } else {
        const response = await api.post(
          "/submissions/run",
          {
            slug: problem?.slug || "two-sum",
            language,
            code,
          },
          { timeout: 60000 }
        );
        const data = response.data?.data || response.data;
        setExecution({
          ...data,
          timeMs: data.executionTimeMs ?? data.timeMs,
        });
      }
    } catch (error) {
      if (error.response?.status === 429) {
        setExecutionError("Rate limit exceeded: You can submit at most 10 times per minute. Please wait a moment before submitting again.");
      } else {
        setExecutionError(
          error.response?.data?.message ||
            (error.code === "ECONNABORTED" ? "Execution timed out. Please try again." : error.message)
        );
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      if (runBtn) {
        runBtn.disabled = liveRef.current.ownFinished || liveRef.current.finalizing;
        const span = runBtn.querySelector("span");
        if (span) span.innerHTML = 'Run Tests <span class="text-muted font-caption text-[10px]">(Ctrl+↵)</span>';
      }
      if (submitBtn) {
        submitBtn.disabled = liveRef.current.ownFinished || liveRef.current.finalizing;
        const span = submitBtn.querySelector("span:last-child");
        if (span) span.textContent = "SUBMIT SOLUTION (Alt+↵)";
      }
      syncEditorState();
    }
  }

  useEffect(() => {
    if (popup && !popupRef.current?.open) popupRef.current?.showModal();
    if (!popup && popupRef.current?.open) popupRef.current?.close();
  }, [popup]);

  function connectArena() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    updateHudAndTelemetry();
    updateChatStream();

    const editor = doc.getElementById("battle-code-editor");
    const gutter = doc.querySelector("#editor-wrapper > div:first-child");

    const starter =
      codeByLangRef.current[currentLangRef.current] ??
      problem?.starterCode?.[currentLangRef.current] ??
      defaultTemplates[0];

    if (editor) {
      editor.value = starter;
    }

    function updateLines() {
      if (!gutter || !editor) return;
      gutter.replaceChildren(
        ...Array.from({ length: Math.max(16, editor.value.split("\n").length) }, (_, index) => {
          const line = doc.createElement("div");
          line.textContent = index + 1;
          return line;
        })
      );
      gutter.scrollTop = editor.scrollTop;
    }

    if (editor) {
      editor.addEventListener("input", () => {
        if (editor.readOnly) return;
        codeByLangRef.current[currentLangRef.current] = editor.value;
        editorChanged();
        updateLines();
      });
      editor.addEventListener("scroll", () => {
        gutter.scrollTop = editor.scrollTop;
      });
      editor.addEventListener("keydown", (event) => {
        if (event.key === "Tab" && !editor.readOnly) {
          event.preventDefault();
          editor.setRangeText("    ", editor.selectionStart, editor.selectionEnd, "end");
          codeByLangRef.current[currentLangRef.current] = editor.value;
          editorChanged();
          updateLines();
        }
      });
    }

    const langTabs = doc.querySelectorAll(".lang-tab");
    langTabs.forEach((tab, index) => {
      tab.addEventListener("click", () => {
        const state = liveRef.current;
        if (state.ownFinished || state.finalizing || state.finishing || state.remainingTime <= 0 || busyRef.current) return;
        if (editor) {
          codeByLangRef.current[currentLangRef.current] = editor.value;
        }

        const newLang = langKeys[index];
        currentLangRef.current = newLang;
        dirtyRef.current = true;
        draftVersionRef.current++;

        langTabs.forEach((t) => {
          t.className = "lang-tab px-2.5 py-0.5 rounded text-muted hover:text-on-surface font-caption text-[11px] transition-all";
        });
        tab.className = "lang-tab px-2.5 py-0.5 rounded bg-primary-container text-on-primary font-caption text-[11px] font-bold shadow-sm";

        const myLangBadge = doc.getElementById("hud-my-lang");
        if (myLangBadge) myLangBadge.textContent = langLabels[index];

        const filenameEl = doc.getElementById("editor-filename");
        if (filenameEl) {
          filenameEl.textContent = `${problem?.slug || "solution"}.${langExts[index]}`;
        }

        const nextCode =
          codeByLangRef.current[newLang] ??
          problem?.starterCode?.[newLang] ??
          defaultTemplates[index];

        if (editor) {
          editor.value = nextCode;
        }
        persistEditor();
        scheduleDraft(true);
        updateLines();
      });
    });

    const resetBtn = doc.getElementById("reset-code-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (editor?.readOnly) return;
        const langIdx = langKeys.indexOf(currentLangRef.current);
        const resetVal =
          problem?.starterCode?.[currentLangRef.current] ||
          defaultTemplates[langIdx >= 0 ? langIdx : 0];
        codeByLangRef.current[currentLangRef.current] = resetVal;
        if (editor) editor.value = resetVal;
        editorChanged();
        updateLines();
      });
    }

    const footerContainer = doc.getElementById("question-test-footer");
    if (footerContainer && problem?.sampleTestCases?.length) {
      const cases = problem.sampleTestCases;
      footerContainer.innerHTML = `
        <div class="flex items-center justify-between text-caption text-muted mb-1 text-[11px]">
          <span>Local Test Cases</span>
          <span class="text-primary-container font-mono text-[10px]">${cases.length} / ${cases.length} Ready</span>
        </div>
        <div class="grid grid-cols-${Math.min(cases.length, 4)} gap-1" id="local-case-buttons">
          ${cases
            .map(
              (tc, idx) => `
            <button type="button" data-index="${idx}" class="case-btn py-1 px-1 rounded bg-surface-container-highest hover:bg-surface-bright text-[10px] font-mono text-on-surface transition-all active:scale-95 text-center truncate" title="${escapeHtml(typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input))}">
              Case ${idx + 1}
            </button>
          `
            )
            .join("")}
        </div>
      `;
      footerContainer.querySelectorAll(".case-btn").forEach((button) => {
        button.addEventListener("click", () => {
          const idx = parseInt(button.getAttribute("data-index"), 10) || 0;
          setSelectedCase(idx);
          setPopup("cases");
        });
      });
    }

    const runBtn = doc.getElementById("run-local-tests-btn");
    if (runBtn) {
      runBtn.setAttribute("type", "button");
      runBtn.addEventListener("click", () => execute(false));
    }

    const submitBtn = doc.getElementById("submit-duel-btn");
    if (submitBtn) {
      submitBtn.setAttribute("type", "button");
      const submitLabel = doc.querySelector("#submit-duel-btn > span:last-child");
      if (submitLabel) submitLabel.textContent = "SUBMIT SOLUTION (Alt+↵)";
      submitBtn.addEventListener("click", () => execute(true));
    }

    let finishBtn = doc.getElementById("finish-duel-btn");
    if (!finishBtn && submitBtn) {
      finishBtn = doc.createElement("button");
      finishBtn.id = "finish-duel-btn";
      finishBtn.type = "button";
      finishBtn.className = "px-3 py-2 rounded border border-primary-container/40 text-primary-container bg-surface-container font-mono text-xs disabled:opacity-50";
      finishBtn.textContent = "FINISH";
      submitBtn.before(finishBtn);
      finishBtn.addEventListener("click", () => {
        const state = liveRef.current;
        if (!state.ownFinished && !state.finalizing && !state.finishing && !busyRef.current && state.remainingTime > 0) setConfirmFinish(true);
      });
    }
    syncEditorState();

    const concedeBtn = doc.getElementById("concede-btn");
    if (concedeBtn) {
      concedeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setConcede(true);
      });
    }

    const chatModal = doc.getElementById("floating-chat-modal");
    const chatTrigger = doc.getElementById("floating-chat-trigger");
    const chatCloseBtn = doc.getElementById("chat-close-btn");
    const chatBadge = doc.getElementById("chat-unread-badge");

    if (chatTrigger) {
      chatTrigger.addEventListener("click", () => {
        unreadCountRef.current = 0;
        if (chatBadge) {
          chatBadge.classList.add("hidden");
          chatBadge.textContent = "0";
        }
      });
    }

    const chatForm = doc.getElementById("chat-form");
    const chatInput = doc.getElementById("chat-input");

    if (chatForm) {
      chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const val = chatInput?.value?.trim();
        if (val) {
          sendChatMessage(val);
          if (chatInput) chatInput.value = "";
        }
      });
    }

    doc.querySelectorAll(".quick-phrase-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.innerText.trim();
        if (text) sendChatMessage(text);
      });
    });

    doc.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        execute(false);
      }
      if (event.altKey && event.key === "Enter") {
        event.preventDefault();
        execute(true);
      }
    });

    syncEditorState();
    updateLines();
  }

  const handleFinish = async () => {
    setConfirmFinish(false);
    setFinishing(true);
    try {
      const saved = await publishDraft(true);
      if (!saved) return;
      await finishBattle();
    } catch (error) {
      setDraftError(error.message);
    } finally {
      setFinishing(false);
    }
  };

  const handleConcede = () => {
    setConcede(false);
    forfeitBattle();
  };

  const sampleCases = problem?.sampleTestCases || [];

  if (interview?.entered || activeBattle?.myPhase === "done" || finalizing) return <AIInterview embedded />;

  return (
    <>
      {(activeBattle?.opponentFinished || ownFinished || finalizing || finishing || draftError) && (
        <div role="status" aria-live="polite" className="fixed top-[72px] left-1/2 z-[65] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-lg border border-[#FDDF49]/40 bg-[#1E2020]/95 px-5 py-3 text-sm text-[#FDDF49] shadow-xl">
          {finalizing ? <p>Evaluating both solutions…</p> : ownFinished ? <p>Evaluating your solution… your interview starts next</p> : finishing ? <p>Finishing your solution…</p> : null}
          {activeBattle?.opponentFinished && !finalizing && <p>{opponent?.username || "Opponent"} finished with {activeBattle.opponentProgress?.bestPassed ?? opponentProgress?.passedCount ?? 0}/{activeBattle.opponentProgress?.totalTests ?? totalTests}. You have {Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, "0")} left.</p>}
          {draftError && !ownFinished && !finalizing && <p className="mt-1 text-[#e2e2e2]">Draft not saved: {draftError}</p>}
        </div>
      )}
      {disconnectCountdown !== null && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 rounded-lg border border-rose-500/50 bg-[#1a0e10]/95 px-5 py-2.5 text-rose-200 shadow-2xl backdrop-blur-md">
          <span className="h-2.5 w-2.5 animate-ping rounded-full bg-rose-500" />
          <span className="text-xs font-semibold">
            Opponent disconnected. Conceding match to you in{" "}
            <span className="font-mono font-bold text-white">{disconnectCountdown}s</span> unless they reconnect...
          </span>
        </div>
      )}

      <iframe
        ref={frameRef}
        src="/battle-arena.html"
        title="Code Arena 1v1 Battle"
        onLoad={connectArena}
        className="block h-dvh w-full border-0 bg-[#121414]"
      />

      {confirmFinish && !locked && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="finish-heading" className="w-full max-w-sm rounded-xl border border-[#FDDF49]/30 bg-[#1E2020] p-6 text-[#e2e2e2] shadow-2xl">
            <h2 id="finish-heading" className="text-lg font-semibold text-[#FDDF49]">Finish this solution?</h2>
            <p className="mt-2 text-sm text-[#9A9A9A]">Your latest code will be evaluated against all tests. You cannot edit or submit after finishing.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button autoFocus onClick={() => setConfirmFinish(false)} className="rounded bg-white/5 px-4 py-2 text-sm">Keep coding</button>
              <button onClick={handleFinish} className="rounded bg-[#FDDF49] px-4 py-2 text-sm font-bold text-[#211b00]">Finish</button>
            </div>
          </div>
        </div>
      )}
      {concede && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="concede-heading" className="w-full max-w-sm rounded-xl border border-white/10 bg-[#16191c] p-6 shadow-2xl">
            <h2 id="concede-heading" className="text-lg font-semibold text-white">Forfeit this duel?</h2>
            <p className="mt-2 text-sm text-[#a7b3ca]">Forfeiting will immediately concede the match. Your opponent will receive the victory.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConcede(false)} className="rounded-md bg-white/5 px-4 py-2 text-xs text-white hover:bg-white/10">Keep playing</button>
              <button onClick={handleConcede} className="rounded-md bg-[#963c47] px-4 py-2 text-xs text-white hover:bg-[#a84450]">Concede</button>
            </div>
          </div>
        </div>
      )}

      <dialog
        ref={popupRef}
        onCancel={() => setPopup(null)}
        onClose={() => setPopup(null)}
        onClick={(event) => {
          if (event.target === popupRef.current) {
            const box = popupRef.current.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) {
              setPopup(null);
            }
          }
        }}
        aria-labelledby="arena-popup-title"
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl rounded-xl border border-[#343e50] bg-[#151a23] p-0 text-[#e4eaf5] shadow-2xl backdrop:bg-black/75"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="arena-popup-title" className="text-base font-semibold">
            {popup === "cases" ? "Sample test cases" : "Evaluation results"}
          </h2>
          <button autoFocus onClick={() => setPopup(null)} aria-label="Close popup" className="rounded px-2 py-1 text-lg text-[#a7b3ca] hover:bg-white/5">&times;</button>
        </div>

        {popup === "cases" ? (
          <div className="p-6">
            <div role="tablist" aria-label="Test cases" className="mb-5 flex gap-2">
              {sampleCases.map((_, index) => (
                <button
                  key={index}
                  role="tab"
                  aria-selected={selectedCase === index}
                  onClick={() => setSelectedCase(index)}
                  className={`rounded-md border px-4 py-2 text-xs ${selectedCase === index ? "border-[#fddf49]/40 bg-[#fddf49]/10 text-[#fddf49]" : "border-white/10 text-[#a7b3ca] hover:bg-white/5"}`}
                >
                  Case {index + 1}
                </button>
              ))}
            </div>
            <div className="space-y-4 rounded-lg border border-white/10 bg-[#0e131c] p-5">
              <div>
                <p className="mb-1.5 text-xs text-[#929bab]">Input</p>
                <code className="block break-words rounded-md bg-white/[.04] px-3 py-2 text-sm text-[#e4eaf5]">
                  {typeof sampleCases[selectedCase]?.input === "object" ? JSON.stringify(sampleCases[selectedCase]?.input) : sampleCases[selectedCase]?.input || "(empty)"}
                </code>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-[#929bab]">Expected output</p>
                <code className="block break-words rounded-md bg-white/[.04] px-3 py-2 text-sm text-[#94bc9d]">
                  {sampleCases[selectedCase]?.expectedOutput || sampleCases[selectedCase]?.expected || "(empty)"}
                </code>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto p-6" aria-live="polite">
            {busy ? (
              <p className="text-sm text-[#a7b3ca]">Evaluating code in Docker sandbox...</p>
            ) : executionError ? (
              <p role="alert" className="whitespace-pre-wrap text-sm text-[#e79aa5]">{executionError}</p>
            ) : execution ? (
              <>
                <p className={`mb-4 text-sm font-semibold ${execution.status === "accepted" ? "text-[#94bc9d]" : "text-[#e79aa5]"}`}>
                  {execution.status?.toUpperCase()} — {execution.passedCount || 0} of {execution.totalCount || totalTests} tests passed
                  {execution.timeMs !== undefined && ` (${execution.timeMs}ms)`}
                </p>
                {execution.error && <pre className="mb-4 whitespace-pre-wrap break-words text-xs text-[#e79aa5]">{execution.error}</pre>}
                <div className="space-y-3">
                  {execution.testResults?.map((test, index) => (
                    <div key={index} className="rounded-lg border border-white/10 bg-[#0e131c] p-4">
                      <p className="mb-2 text-xs">Case {index + 1}: <span className={test.passed ? "text-[#94bc9d]" : "text-[#e79aa5]"}>{test.passed ? "Passed" : "Failed"}</span></p>
                      {test.output !== undefined && <p className="break-words font-mono text-xs text-[#a7b3ca]">Output: {test.output || "(empty)"}</p>}
                      {(test.expectedOutput !== undefined || test.expected !== undefined) && <p className="mt-1 font-mono text-xs text-[#a7b3ca]">Expected: {test.expectedOutput || test.expected}</p>}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button onClick={() => setPopup(null)} className="rounded-md border border-white/10 px-4 py-2 text-xs hover:bg-white/5">Close</button>
        </div>
      </dialog>
    </>
  );
}
