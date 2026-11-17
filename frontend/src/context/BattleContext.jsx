import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import api from "../services/api";
import { getSocket } from "../services/socket";

const BattleContext = createContext(null);

export const toTimestamp = (val) => {
  if (!val) return null;
  if (typeof val === "number") return val;
  const t = new Date(val).getTime();
  return isNaN(t) ? null : t;
};

export function BattleProvider({ children }) {
  const { user, refreshUser } = useAuth();

  const [inQueue, setInQueue] = useState(false);
  const [queueTime, setQueueTime] = useState(0);
  const [playersInQueue, setPlayersInQueue] = useState(0);

  const [pendingMatch, setPendingMatch] = useState(null);
  const [hasAccepted, setHasAccepted] = useState(false);

  const [activeBattle, setActiveBattle] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [opponentProgress, setOpponentProgress] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(null);

  const [battleResult, setBattleResult] = useState(null);
  const [duelState, setDuelState] = useState("closed");
  const [timeOffset, setTimeOffset] = useState(0);
  const [resultSync, setResultSync] = useState({ checking: false, error: "", lastCheckedAt: null });
  const resultRequestRef = useRef(null);
  const forfeitRequestRef = useRef(null);
  const [forfeitPending, setForfeitPending] = useState(false);
  const [interview, setInterview] = useState(null);
  const interviewRef = useRef(null);
  const interviewVersionRef = useRef(0);
  const mergeInterview = useCallback((changes) => {
    const next = { ...interviewRef.current, ...changes };
    interviewRef.current = next;
    setInterview(next);
    return next;
  }, []);
  const mergeHistory = (current = [], incoming = []) => [...new Map([...current, ...incoming].map((entry) => [entry.index, entry])).values()].sort((a, b) => a.index - b.index);

  const queueTimerRef = useRef(null);
  const activeBattleRef = useRef(null);
  const pendingMatchRef = useRef(null);
  const draftQueueRef = useRef(Promise.resolve());
  const lastDraftAtRef = useRef(0);
  const pendingSubmissionRef = useRef(null);
  const completedBattleRef = useRef(null);
  const updateBattle = (changes) => {
    if (!activeBattleRef.current) return;
    const next = { ...activeBattleRef.current, ...changes };
    activeBattleRef.current = next;
    setActiveBattle(next);
  };
  const receiveBattleResult = useCallback((data) => {
    if (!data?.battleId || completedBattleRef.current === data.battleId) return;
    completedBattleRef.current = data.battleId;
    activeBattleRef.current = null;
    setBattleResult(data);
    setActiveBattle(null);
    setDuelState("report_full");
    setResultSync({ battleId: data.battleId, checking: false, error: "", lastCheckedAt: Date.now() });
    try { localStorage.setItem("lastBattleId", data.battleId); } catch {}
    refreshUser?.();
  }, [refreshUser]);

  const rememberCode = (battleId, language, code) => {
    try {
      sessionStorage.setItem(`battle-code:${battleId}:${user?._id}`, JSON.stringify({ language, code }));
    } catch {}
  };

  useEffect(() => {
    activeBattleRef.current = activeBattle;
  }, [activeBattle]);

  useEffect(() => {
    pendingMatchRef.current = pendingMatch;
  }, [pendingMatch]);

  const joinInterview = useCallback(async () => {
    const battle = activeBattleRef.current;
    const socket = getSocket();
    if (!battle?.battleId || !socket?.connected) throw new Error("Reconnect to resume your interview");
    const version = interviewVersionRef.current;
    const ack = await new Promise((resolve, reject) => {
      socket.timeout(10000).emit("interview_join", { battleId: battle.battleId }, (error, response) => error ? reject(new Error("Could not resume interview. Try again.")) : resolve(response));
    });
    if (!ack?.success) throw new Error(ack?.message || "Could not resume interview");
    if (activeBattleRef.current?.battleId !== battle.battleId) return ack;
    const current = interviewRef.current;
    const terminal = ["done", "skipped", "failed"].includes(ack.status);
    const stale = version !== interviewVersionRef.current;
    mergeInterview({
      ...(stale ? {} : { status: ack.status, question: terminal ? null : ack.question, thinking: !terminal && !ack.question, interviewDeadlineAt: ack.interviewDeadlineAt, answeredCount: ack.answeredCount, total: ack.total }),
      battleId: battle.battleId,
      entered: true,
      finalCode: ack.finalCode,
      history: mergeHistory(current?.history, ack.history),
    });
    if (ack.serverNow) setTimeOffset(ack.serverNow - Date.now());
    if (terminal && !stale) {
      const next = { ...activeBattleRef.current, myPhase: "done", ownFinished: true };
      activeBattleRef.current = next;
      setActiveBattle(next);
    }
    return ack;
  }, [mergeInterview]);

  const answerInterview = useCallback(async ({ questionIndex, text, inputMode, skip = false }) => {
    const battle = activeBattleRef.current;
    const current = interviewRef.current;
    const socket = getSocket();
    if (!battle || battle.status !== "active" || !socket?.connected) throw new Error("Reconnect before sending your answer");
    if (typeof text !== "string" || text.length > 2000) throw new Error("Answers can contain at most 2000 characters");
    const question = current?.question;
    const ack = await new Promise((resolve, reject) => {
      socket.timeout(15000).emit("interview_answer", { battleId: battle.battleId, questionIndex, text, inputMode, skip }, (error, response) => error ? reject(new Error("Answer acknowledgment timed out. Reconnect or retry.")) : resolve(response));
    });
    if (!ack?.success) throw new Error(ack?.message || "Answer was not accepted");
    if (activeBattleRef.current?.battleId === battle.battleId) {
      const latest = interviewRef.current;
      interviewVersionRef.current++;
      const entry = question?.index === questionIndex && !/duplicate/i.test(ack.message || "") ? [{ index: questionIndex, text: question.text, answer: skip ? "" : text, status: skip ? "skipped" : "answered" }] : [];
      mergeInterview({ history: mergeHistory(latest?.history, entry), ...(latest?.question?.index === questionIndex ? { question: null, thinking: true } : {}) });
    }
    if (/duplicate/i.test(ack.message || "")) joinInterview().catch(() => {});
    return ack;
  }, [mergeInterview, joinInterview]);

  const applyBattleState = useCallback((data) => {
    if (!data || data.battleId === completedBattleRef.current) return;
    if (data.serverNow) {
      setTimeOffset(data.serverNow - Date.now());
    }
    if (data.status === "pending") {
      setPendingMatch(data);
      setDuelState("found");
    } else if (data.status === "active" || data.status === "finalizing") {
      const current = activeBattleRef.current;
      const sameBattle = current?.battleId === data.battleId;
      const phaseOrder = { coding: 0, interview: 1, done: 2 };
      const next = {
        ...data,
        myPhase: sameBattle && phaseOrder[current.myPhase] > phaseOrder[data.myPhase] ? current.myPhase : data.myPhase || "coding",
        opponentPhase: sameBattle && phaseOrder[current.opponentPhase] > phaseOrder[data.opponentPhase] ? current.opponentPhase : data.opponentPhase || "coding",
        opponentInterview: sameBattle ? current.opponentInterview : null,
        ownFinished: !!data.ownFinished || (sameBattle && !!current.ownFinished),
        opponentFinished: !!data.opponentFinished || (sameBattle && !!current.opponentFinished),
        status: sameBattle && current.status === "finalizing" ? "finalizing" : data.status,
        endsAt: sameBattle && current.endsAt && data.endsAt ? Math.min(toTimestamp(current.endsAt), toTimestamp(data.endsAt)) : data.endsAt,
      };
      activeBattleRef.current = next;
      setActiveBattle(next);
      if (data.lastChatMessages) setChatMessages(data.lastChatMessages);
      if (data.opponentProgress) setOpponentProgress(data.opponentProgress);
      setDuelState("battle");
      if (next.myPhase !== "coding" || next.status === "finalizing") {
        mergeInterview({ battleId: next.battleId, entered: true });
        if (getSocket()?.connected) joinInterview().catch(() => {});
      }
    }
  }, [joinInterview, mergeInterview]);

  const refreshBattleResult = useCallback(() => {
    const battle = activeBattleRef.current;
    if (!battle?.battleId) return Promise.resolve(null);
    const battleId = battle.battleId;
    if (resultRequestRef.current?.battleId === battleId) return resultRequestRef.current.promise;

    const request = { battleId, promise: null };
    resultRequestRef.current = request;
    request.promise = (async () => {
      setResultSync((previous) => ({ ...previous, battleId, checking: true, error: "" }));
      try {
        if (battle.status !== "finalizing") {
          const response = await api.get("/battles/active", { timeout: 10000 });
          if (activeBattleRef.current?.battleId !== battleId) return null;
          const current = response.data?.data?.battle;
          if (current?.battleId === battleId) {
            applyBattleState(current);
            if (current.status !== "finalizing") {
              setResultSync({ battleId, checking: false, error: "", lastCheckedAt: Date.now() });
              return current;
            }
          }
        }
        const response = await api.get(`/battles/${battleId}`, { timeout: 10000 });
        if (activeBattleRef.current?.battleId !== battleId) return null;
        const data = response.data?.data;
        if (data?.battleId !== battleId) throw new Error("Unexpected battle result");
        if (["finished", "abandoned"].includes(data.status)) receiveBattleResult(data);
        else setResultSync({ battleId, checking: false, error: "", lastCheckedAt: Date.now() });
        return data;
      } catch {
        if (activeBattleRef.current?.battleId === battleId) {
          setResultSync({ battleId, checking: false, error: "Could not check the saved result. Please try again.", lastCheckedAt: Date.now() });
        }
        return null;
      } finally {
        if (resultRequestRef.current === request) resultRequestRef.current = null;
      }
    })();
    return request.promise;
  }, [applyBattleState, receiveBattleResult]);

  useEffect(() => {
    if (!activeBattle?.battleId || (activeBattle.status !== "finalizing" && activeBattle.myPhase !== "done")) return;
    let cancelled = false;
    let checking = false;
    let timer;
    const sync = async () => {
      if (cancelled || checking) return;
      checking = true;
      clearTimeout(timer);
      try { await refreshBattleResult(); }
      finally { checking = false; if (!cancelled) timer = setTimeout(sync, 3000); }
    };
    const resume = () => { if (document.visibilityState === "visible") sync(); };
    sync();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [activeBattle?.battleId, activeBattle?.status, activeBattle?.myPhase, refreshBattleResult]);

  useEffect(() => {
    if (inQueue) {
      queueTimerRef.current = setInterval(() => {
        setQueueTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      setQueueTime(0);
    }
    return () => {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    };
  }, [inQueue]);

  useEffect(() => {
    if (!user) {
      getSocket()?.emit("queue_leave");
      setInQueue(false);
      setPendingMatch(null);
      activeBattleRef.current = null;
      pendingSubmissionRef.current = null;
      setActiveBattle(null);
      setBattleResult(null);
      interviewRef.current = null;
      setInterview(null);
      setDuelState("closed");
      return;
    }

    let isMounted = true;

    const checkActiveBattle = async () => {
      try {
        const res = await api.get("/battles/active");
        const b = res.data?.data?.battle;
        if (!b || !isMounted) return;

        applyBattleState(b);

        const socket = getSocket();
        if (socket?.connected && b.battleId) {
          socket.emit("battle_join", { battleId: b.battleId }, (ack) => {
            if (ack?.success && ack.data) {
              if (ack.data.status === "finished") refreshBattleResult();
              else applyBattleState(ack.data);
            }
          });
        }
      } catch {}
    };

    checkActiveBattle();

    return () => {
      isMounted = false;
    };
  }, [user, applyBattleState, refreshBattleResult]);

  useEffect(() => {
    if (!user) return;

    let cleanupSocket;
    let socketInterval;
    const attachSocket = () => {
      const socket = getSocket();
      if (!socket) return;
      clearInterval(socketInterval);

      const onConnect = () => {
        const currentBattleId = activeBattleRef.current?.battleId || pendingMatchRef.current?.battleId;
        if (currentBattleId) {
          socket.emit("battle_join", { battleId: currentBattleId }, (ack) => {
            if (ack?.success && ack.data) {
              if (ack.data.status === "finished") refreshBattleResult();
              else applyBattleState(ack.data);
            }
          });
          if (activeBattleRef.current?.myPhase === "done" || activeBattleRef.current?.status === "finalizing") refreshBattleResult();
        }
      };

      const onQueueStatus = (data) => {
        if (data.waitingSeconds !== undefined) setQueueTime(data.waitingSeconds);
        if (data.playersInQueue !== undefined) setPlayersInQueue(data.playersInQueue);
      };

      const onQueueError = (data) => {
        setInQueue(false);
        setPlayersInQueue(0);
        setDuelState("closed");
        alert(data?.message || "Could not find a match. Please try again.");
      };

      const onMatchFound = (data) => {
        if (data.serverNow) setTimeOffset(data.serverNow - Date.now());
        setPendingMatch(data);
        setHasAccepted(false);
        setInQueue(false);
        setDuelState("found");
      };

      const onMatchCancelled = () => {
        setPendingMatch(null);
        setHasAccepted(false);
        setDuelState("closed");
      };

      const onBattleStart = (data) => {
        completedBattleRef.current = null;
        if (data.serverNow) setTimeOffset(data.serverNow - Date.now());
        setPendingMatch(null);
        setHasAccepted(false);
        interviewRef.current = null;
        setInterview(null);
        interviewVersionRef.current++;
        activeBattleRef.current = { ...data, status: "active", myPhase: "coding", opponentPhase: "coding", ownFinished: false, opponentFinished: false };
        setActiveBattle(activeBattleRef.current);
        setSubmissionResult(null);
        setBattleResult(null);
        setOpponentDisconnected(null);
        setChatMessages([]);
        setOpponentProgress(data.opponentProgress || { passedCount: 0, totalCount: data.problem?.sampleTestCases?.length || 0 });
        setDuelState("battle");
      };

      const onBattleState = (data) => {
        if (data?.status === "finished") refreshBattleResult();
        else applyBattleState(data);
      };

      const onBattleChatMessage = (msg) => {
        setChatMessages((prev) => [...prev, msg]);
      };

      const onOpponentProgress = (data) => {
        setOpponentProgress(data);
      };

      const onSubmissionResult = (data) => {
        setSubmissionResult(data);
      };

      const onOpponentDisconnected = (data) => {
        setOpponentDisconnected(data);
      };

      const onOpponentReconnected = () => {
        setOpponentDisconnected(null);
      };

      const onYouFinished = (data) => {
        const submitted = pendingSubmissionRef.current;
        if (submitted?.battleId === activeBattleRef.current?.battleId) {
          rememberCode(submitted.battleId, submitted.language, submitted.code);
          pendingSubmissionRef.current = null;
        }
        if (data.serverNow) setTimeOffset(data.serverNow - Date.now());
        updateBattle({ ownFinished: true, endsAt: data.endsAt, ownProgress: { bestPassed: data.passedCount, totalTests: data.totalCount } });
      };
      const onOpponentFinished = (data) => {
        if (data.serverNow) setTimeOffset(data.serverNow - Date.now());
        updateBattle({ opponentFinished: true, endsAt: data.endsAt, opponentProgress: { bestPassed: data.passedCount, totalTests: data.totalCount } });
        setOpponentProgress(data);
      };
      const onInterviewThinking = () => {
        if (!activeBattleRef.current) return;
        interviewVersionRef.current++;
        mergeInterview({ battleId: activeBattleRef.current.battleId, thinking: true, question: null });
        updateBattle({ ownFinished: true, myPhase: "interview" });
      };
      const onInterviewStarted = (data) => {
        if (data.battleId === completedBattleRef.current || activeBattleRef.current && data.battleId !== activeBattleRef.current.battleId) return;
        interviewVersionRef.current++;
        if (data.serverNow) setTimeOffset(data.serverNow - Date.now());
        mergeInterview({ battleId: data.battleId, entered: true, status: "active", thinking: false, question: data.question, total: data.total, interviewDeadlineAt: data.interviewDeadlineAt });
        updateBattle({ ownFinished: true, myPhase: "interview" });
        joinInterview().catch(() => {});
      };
      const onInterviewQuestion = (data) => {
        if (!activeBattleRef.current) return;
        interviewVersionRef.current++;
        if (data.serverNow) setTimeOffset(data.serverNow - Date.now());
        mergeInterview({ entered: true, status: "active", thinking: false, question: data });
        joinInterview().catch(() => {});
      };
      const onInterviewComplete = () => {
        if (!activeBattleRef.current) return;
        interviewVersionRef.current++;
        mergeInterview({ entered: true, status: "done", question: null, thinking: false });
        updateBattle({ ownFinished: true, myPhase: "done" });
        joinInterview().catch(() => {});
      };
      const onOpponentPhase = (data) => {
        if (!activeBattleRef.current) return;
        updateBattle({ opponentPhase: data.phase, opponentInterview: { questionIndex: data.questionIndex, total: data.total } });
      };
      const onFinalizing = () => {
        interviewVersionRef.current++;
        updateBattle({ status: "finalizing" });
        mergeInterview({ entered: true, question: null, thinking: false });
      };
      const onBattleEnd = receiveBattleResult;

      socket.on("connect", onConnect);
      socket.on("queue_status", onQueueStatus);
      socket.on("queue_error", onQueueError);
      socket.on("match_found", onMatchFound);
      socket.on("match_cancelled", onMatchCancelled);
      socket.on("battle_start", onBattleStart);
      socket.on("battle_state", onBattleState);
      socket.on("battle_chat_message", onBattleChatMessage);
      socket.on("opponent_progress", onOpponentProgress);
      socket.on("submission_result", onSubmissionResult);
      socket.on("opponent_disconnected", onOpponentDisconnected);
      socket.on("opponent_reconnected", onOpponentReconnected);
      socket.on("you_finished", onYouFinished);
      socket.on("opponent_finished", onOpponentFinished);
      socket.on("battle_finalizing", onFinalizing);
      socket.on("interview_started", onInterviewStarted);
      socket.on("interview_thinking", onInterviewThinking);
      socket.on("interview_question", onInterviewQuestion);
      socket.on("interview_complete", onInterviewComplete);
      socket.on("opponent_phase", onOpponentPhase);
      socket.on("battle_end", onBattleEnd);

      cleanupSocket = () => {
        socket.off("connect", onConnect);
        socket.off("queue_status", onQueueStatus);
        socket.off("queue_error", onQueueError);
        socket.off("match_found", onMatchFound);
        socket.off("match_cancelled", onMatchCancelled);
        socket.off("battle_start", onBattleStart);
        socket.off("battle_state", onBattleState);
        socket.off("battle_chat_message", onBattleChatMessage);
        socket.off("opponent_progress", onOpponentProgress);
        socket.off("submission_result", onSubmissionResult);
        socket.off("opponent_disconnected", onOpponentDisconnected);
        socket.off("opponent_reconnected", onOpponentReconnected);
        socket.off("you_finished", onYouFinished);
        socket.off("opponent_finished", onOpponentFinished);
        socket.off("battle_finalizing", onFinalizing);
        socket.off("interview_started", onInterviewStarted);
        socket.off("interview_thinking", onInterviewThinking);
        socket.off("interview_question", onInterviewQuestion);
        socket.off("interview_complete", onInterviewComplete);
        socket.off("opponent_phase", onOpponentPhase);
        socket.off("battle_end", onBattleEnd);
      };
    };
    attachSocket();
    if (!cleanupSocket) socketInterval = setInterval(attachSocket, 200);

    return () => {
      clearInterval(socketInterval);
      cleanupSocket?.();
    };
  }, [user, receiveBattleResult, applyBattleState, refreshBattleResult]);

  const joinQueue = (mode = "ranked_1v1") => {
    const socket = getSocket();
    setInQueue(true);
    setDuelState("queue");
    socket?.emit("queue_join", { mode }, async (ack) => {
      if (ack && !ack.success) {
        if (ack.message?.toLowerCase().includes("already in a battle")) {
          setInQueue(false);
          try {
            const res = await api.get("/battles/active");
            const b = res.data?.data?.battle;
            if (b) {
              applyBattleState(b);
              alert("Already in a battle");
              return;
            }
          } catch {}
          alert("Already in a battle");
          setDuelState("closed");
        } else if (ack.message?.toLowerCase().includes("already in queue")) {
          setInQueue(true);
          setDuelState("queue");
        } else {
          setInQueue(false);
          setDuelState("closed");
          alert(ack.message || "Could not join the queue. Please try again.");
        }
      }
    });
  };

  const leaveQueue = () => {
    const socket = getSocket();
    setInQueue(false);
    setDuelState("closed");
    socket?.emit("queue_leave");
  };

  const acceptMatch = (onFail) => {
    if (!pendingMatch) return;
    const socket = getSocket();
    setHasAccepted(true);
    socket?.emit("match_accept", { battleId: pendingMatch.battleId }, (ack) => {
      if (ack && !ack.success) {
        setHasAccepted(false);
        onFail?.(ack.message || "Failed to accept match");
      }
    });
  };

  const declineMatch = (onFail) => {
    if (!pendingMatch) return;
    const socket = getSocket();
    socket?.emit("match_decline", { battleId: pendingMatch.battleId }, (ack) => {
      if (ack && !ack.success) {
        onFail?.(ack.message || "Failed to decline match");
      }
    });
    setPendingMatch(null);
    setHasAccepted(false);
    setDuelState("closed");
  };

  const forfeitBattle = () => {
    if (forfeitRequestRef.current) return forfeitRequestRef.current;
    const battle = activeBattleRef.current;
    const socket = getSocket();
    if (!battle?.battleId || battle.status !== "active") return Promise.reject(new Error("This duel has already ended or is saving its result."));
    if (!socket?.connected) return Promise.reject(new Error("Reconnect before surrendering. Your duel is still active."));
    setForfeitPending(true);
    const request = new Promise((resolve, reject) => {
      socket.timeout(15000).emit("battle_forfeit", { battleId: battle.battleId }, (error, ack) => {
        if (error) reject(new Error("Surrender was not confirmed. Check your connection and try again."));
        else if (!ack?.success) reject(new Error(ack?.message || "Could not surrender. Please try again."));
        else resolve(ack);
      });
    }).then((ack) => {
      if (activeBattleRef.current?.battleId === battle.battleId) {
        updateBattle({ status: "finalizing", myPhase: "done", ownFinished: true });
        refreshBattleResult();
      }
      return ack;
    }).catch(async (error) => {
      // A lost acknowledgment may follow a successful surrender. Recover its result
      // before allowing another attempt; the server still owns the outcome.
      await refreshBattleResult();
      if (completedBattleRef.current === battle.battleId || (activeBattleRef.current?.battleId === battle.battleId && activeBattleRef.current.status === "finalizing")) return { success: true };
      throw error;
    }).finally(() => {
      if (forfeitRequestRef.current === request) {
        forfeitRequestRef.current = null;
        setForfeitPending(false);
      }
    });
    forfeitRequestRef.current = request;
    return request;
  };

  const sendChatMessage = (text, onFail) => {
    if (!activeBattle || !text?.trim()) return;
    const socket = getSocket();
    socket?.emit("battle_chat", { battleId: activeBattle.battleId, text: text.trim() }, (ack) => {
      if (ack && !ack.success) {
        const errorText = ack.message || "Failed to send message";
        setChatMessages((prev) => [
          ...prev,
          { isSystem: true, error: true, text: errorText, at: Date.now() },
        ]);
        onFail?.(errorText);
      }
    });
  };

  const saveCodeDraft = ({ language, code }) => {
    const battleId = activeBattleRef.current?.battleId;
    const send = async () => {
      const wait = Math.max(0, 2100 - (Date.now() - lastDraftAtRef.current));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      const battle = activeBattleRef.current;
      if (!battleId || battle?.battleId !== battleId || battle.ownFinished || battle.status !== "active") throw new Error("Your solution is locked");
      if (typeof code !== "string" || code.length > 20000) throw new Error("Code must be at most 20000 characters");
      const socket = getSocket();
      if (!socket?.connected) throw new Error("Reconnect before saving your code");
      lastDraftAtRef.current = Date.now();
      const ack = await new Promise((resolve, reject) => {
        socket.timeout(10000).emit("code_draft", { battleId, language, code }, (error, response) => error ? reject(new Error("Draft save timed out")) : resolve(response));
      });
      if (!ack?.success) throw new Error(ack?.message || "Could not save draft");
      rememberCode(battleId, language, code);
      return ack;
    };
    const pending = draftQueueRef.current.catch(() => {}).then(send);
    draftQueueRef.current = pending;
    return pending;
  };

  const finishBattle = async () => {
    await draftQueueRef.current;
    const battle = activeBattleRef.current;
    if (!battle || battle.ownFinished || battle.status !== "active") throw new Error("Your solution is locked");
    const socket = getSocket();
    if (!socket?.connected) throw new Error("Reconnect before finishing");
    const ack = await new Promise((resolve, reject) => {
      socket.timeout(120000).emit("battle_finish", { battleId: battle.battleId }, (error, response) => error ? reject(new Error("Finish timed out; reconnect to restore battle state")) : resolve(response));
    });
    if (!ack?.success) throw new Error(ack?.message || "Could not finish");
    return ack;
  };

  const submitBattleCode = async ({ language, code }) => {
    const battle = activeBattleRef.current;
    if (!battle || battle.ownFinished || battle.status !== "active") throw new Error("Your solution is locked");
    await draftQueueRef.current.catch(() => {});
    const current = activeBattleRef.current;
    if (current?.battleId !== battle.battleId || current.ownFinished || current.status !== "active") throw new Error("Your solution is locked");
    pendingSubmissionRef.current = { battleId: battle.battleId, language, code };
    try {
      const res = await api.post(`/battles/${battle.battleId}/submit`, { language, code }, { timeout: 120000 });
      rememberCode(battle.battleId, language, code);
      return res.data;
    } finally {
      pendingSubmissionRef.current = null;
    }
  };

  return (
    <BattleContext.Provider
      value={{
        inQueue,
        queueTime,
        playersInQueue,
        pendingMatch,
        hasAccepted,
        activeBattle,
        chatMessages,
        opponentProgress,
        submissionResult,
        opponentDisconnected,
        battleResult,
        duelState,
        timeOffset,
        resultSync,
        refreshBattleResult,
        interview,
        joinInterview,
        answerInterview,
        setDuelState,
        joinQueue,
        leaveQueue,
        acceptMatch,
        declineMatch,
        forfeitBattle,
        forfeitPending,
        sendChatMessage,
        submitBattleCode,
        saveCodeDraft,
        finishBattle,
      }}
    >
      {children}
    </BattleContext.Provider>
  );
}

export function useBattle() {
  const context = useContext(BattleContext);
  if (!context) {
    throw new Error("useBattle must be used within a BattleProvider");
  }
  return context;
}
