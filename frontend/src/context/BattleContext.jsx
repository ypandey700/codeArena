import { createContext, useContext, useEffect, useRef, useState } from "react";
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

  const queueTimerRef = useRef(null);
  const activeBattleRef = useRef(null);
  const pendingMatchRef = useRef(null);

  useEffect(() => {
    activeBattleRef.current = activeBattle;
  }, [activeBattle]);

  useEffect(() => {
    pendingMatchRef.current = pendingMatch;
  }, [pendingMatch]);

  const applyBattleState = (data) => {
    if (!data) return;
    if (data.serverNow) {
      setTimeOffset(data.serverNow - Date.now());
    }
    if (data.status === "pending") {
      setPendingMatch(data);
      setDuelState("found");
    } else if (data.status === "active") {
      setActiveBattle(data);
      if (data.lastChatMessages) setChatMessages(data.lastChatMessages);
      if (data.opponentProgress) setOpponentProgress(data.opponentProgress);
      setDuelState("battle");
    } else if (data.status === "finished") {
      setBattleResult(data);
      if (data.battleId) {
        localStorage.setItem("lastBattleId", data.battleId);
      }
      refreshUser?.();
      setActiveBattle(null);
      setDuelState("report_full");
    }
  };

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
      setActiveBattle(null);
      setBattleResult(null);
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
              applyBattleState(ack.data);
            }
          });
        }
      } catch {}
    };

    checkActiveBattle();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let socketInterval = setInterval(() => {
      const socket = getSocket();
      if (!socket) return;
      clearInterval(socketInterval);

      const onConnect = () => {
        const currentBattleId = activeBattleRef.current?.battleId || pendingMatchRef.current?.battleId;
        if (currentBattleId) {
          socket.emit("battle_join", { battleId: currentBattleId }, (ack) => {
            if (ack?.success && ack.data) {
              applyBattleState(ack.data);
            }
          });
        }
      };

      const onQueueStatus = (data) => {
        if (data.waitingSeconds !== undefined) setQueueTime(data.waitingSeconds);
        if (data.playersInQueue !== undefined) setPlayersInQueue(data.playersInQueue);
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
        if (data.serverNow) setTimeOffset(data.serverNow - Date.now());
        setPendingMatch(null);
        setHasAccepted(false);
        setActiveBattle(data);
        setChatMessages([]);
        setOpponentProgress(data.opponentProgress || { passedCount: 0, totalCount: data.problem?.sampleTestCases?.length || 0 });
        setDuelState("battle");
      };

      const onBattleState = (data) => {
        applyBattleState(data);
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

      const onBattleEnd = (data) => {
        setBattleResult(data);
        if (data?.battleId) {
          localStorage.setItem("lastBattleId", data.battleId);
        }
        refreshUser?.();
        setActiveBattle(null);
        setDuelState("report_full");
      };

      socket.on("connect", onConnect);
      socket.on("queue_status", onQueueStatus);
      socket.on("match_found", onMatchFound);
      socket.on("match_cancelled", onMatchCancelled);
      socket.on("battle_start", onBattleStart);
      socket.on("battle_state", onBattleState);
      socket.on("battle_chat_message", onBattleChatMessage);
      socket.on("opponent_progress", onOpponentProgress);
      socket.on("submission_result", onSubmissionResult);
      socket.on("opponent_disconnected", onOpponentDisconnected);
      socket.on("opponent_reconnected", onOpponentReconnected);
      socket.on("battle_end", onBattleEnd);

      return () => {
        socket.off("connect", onConnect);
        socket.off("queue_status", onQueueStatus);
        socket.off("match_found", onMatchFound);
        socket.off("match_cancelled", onMatchCancelled);
        socket.off("battle_start", onBattleStart);
        socket.off("battle_state", onBattleState);
        socket.off("battle_chat_message", onBattleChatMessage);
        socket.off("opponent_progress", onOpponentProgress);
        socket.off("submission_result", onSubmissionResult);
        socket.off("opponent_disconnected", onOpponentDisconnected);
        socket.off("opponent_reconnected", onOpponentReconnected);
        socket.off("battle_end", onBattleEnd);
      };
    }, 200);

    return () => {
      clearInterval(socketInterval);
    };
  }, [user]);

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

  const forfeitBattle = (onFail) => {
    if (!activeBattle) return;
    const socket = getSocket();
    socket?.emit("battle_forfeit", { battleId: activeBattle.battleId }, (ack) => {
      if (ack && !ack.success) {
        onFail?.(ack.message || "Failed to forfeit battle");
      }
    });
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

  const submitBattleCode = async ({ language, code }) => {
    if (!activeBattle) return;
    const res = await api.post(`/battles/${activeBattle.battleId}/submit`, { language, code });
    return res.data;
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
        setDuelState,
        joinQueue,
        leaveQueue,
        acceptMatch,
        declineMatch,
        forfeitBattle,
        sendChatMessage,
        submitBattleCode,
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
