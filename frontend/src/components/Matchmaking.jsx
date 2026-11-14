import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import {
  CheckCircle2, Clock3, Code2, Cpu, Gem, LoaderCircle,
  Minimize2, Shield, Swords, Trophy, Users, X,
} from "lucide-react";

let matchmakingAudio = null;

async function enableMatchmakingAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!matchmakingAudio || matchmakingAudio.state === "closed") {
    matchmakingAudio = new AudioContextClass();
  }
  if (matchmakingAudio.state !== "running") await matchmakingAudio.resume();
  return matchmakingAudio.state === "running" ? matchmakingAudio : null;
}

async function playTone(frequency = 660, duration = 0.18, volume = 0.12) {
  try {
    const context = await enableMatchmakingAudio();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + 0.01;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch {}
}

export function QueueOverlay({ onMinimize, onClose }) {
  const { user } = useAuth();
  const { queueTime, playersInQueue, leaveQueue, setDuelState } = useBattle();
  const frameRef = useRef(null);

  const handleClose = () => {
    leaveQueue();
    onClose?.();
  };

  const handleMinimize = () => {
    setDuelState("minimized");
    onMinimize?.();
  };

  useEffect(() => {
    const keydown = (event) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const minutes = doc.getElementById("queue-timer-minutes");
    const seconds = doc.getElementById("queue-timer-seconds");
    if (minutes) minutes.textContent = String(Math.floor(queueTime / 60)).padStart(2, "0");
    if (seconds) seconds.textContent = String(queueTime % 60).padStart(2, "0");
  }, [queueTime]);

  function connectQueue() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.parentElement.closest("script, style")) continue;
      walker.currentNode.textContent = walker.currentNode.textContent.replaceAll("v0id_runner", user?.username || "You");
    }
    const cancelBtn = doc.getElementById("cancel-queue-action");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleClose();
      });
    }
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape") handleClose();
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-[45] bg-[#0d0f11]">
      <iframe
        ref={frameRef}
        src="/matchmaking-queue.html"
        title="Matchmaking queue"
        onLoad={connectQueue}
        className="h-full w-full border-0"
      />
      <div className="absolute bottom-4 right-4 flex items-center gap-3 rounded-lg border border-white/10 bg-[#16191c]/90 px-4 py-2.5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2 font-mono text-xs text-[#9299a7]">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{playersInQueue} in queue</span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <button
          onClick={handleMinimize}
          className="rounded px-3 py-1.5 text-xs text-[#aab1bf] hover:bg-white/5 hover:text-white"
        >
          Minimize
        </button>
        <button
          onClick={handleClose}
          className="rounded border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
        >
          Cancel Queue
        </button>
      </div>
    </div>
  );
}

function PlayerCard({ user, rival = false, opponent = null }) {
  const name = rival ? (opponent?.username || "Opponent") : (user?.username || "You");
  const wins = Number(user?.stats?.wins || 0);
  const losses = Number(user?.stats?.losses || 0);
  const userRating = Number(user?.rating ?? 1200);
  const oppRating = Number(opponent?.rating ?? 1200);

  const displayRating = rival ? oppRating.toLocaleString() : userRating.toLocaleString();
  const tier = rival ? (opponent?.tier || "GOLD") : (user?.tier || "GOLD");
  const winrate = rival ? (opponent?.winRate || opponent?.winrate || "--") : (wins + losses ? `${((wins / (wins + losses)) * 100).toFixed(1)}%` : "--");
  const streak = rival ? (opponent?.streak ?? "--") : (user?.stats?.streak ?? "--");
  const avatar = rival ? opponent?.avatar : user?.avatar;

  return (
    <article className={`overflow-hidden rounded-lg border border-white/[.08] border-t-2 bg-[#191c1d] ${rival ? "border-t-[#c54c60]" : "border-t-[#fddf49]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-lg font-semibold ${rival ? "border-[#c54c60]/30 bg-[#39222a] text-[#e692a0]" : "border-[#fddf49]/30 bg-[#36321c] text-[#fddf49]"}`}>
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-[#f0f1f4]">{name}</h2>
            <p className={`mt-1 text-xs ${rival ? "text-[#d896a1]" : "text-[#fddf49]"}`}>
              {tier}
              <span className="ml-2 text-[#9299a7]">{displayRating} RR</span>
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${rival ? "bg-[#234139] text-[#94cdb7]" : "bg-[#fddf49]/10 text-[#fddf49]"}`}>
          {rival ? "MATCH READY" : "CONFIRMED"}
        </span>
      </div>
      <div className="mx-3 flex flex-wrap justify-between gap-2 rounded-md bg-[#222627] px-3 py-2.5 text-xs sm:mx-4">
        <span className="text-[#d7d7d1]">Mode: 1v1 Ranked Duel</span>
        <span className="text-[#9299a7]">Isolated Docker Sandbox</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-4 sm:p-6">
        {[
          ["WINRATE", winrate],
          ["STREAK", String(streak)],
          ["RATING", `${displayRating} RR`],
          ["STATUS", "SYNCED"],
        ].map(([label, value], index) => (
          <div key={label} className="rounded-md bg-[#222627] p-2">
            <p className="text-[10px] text-[#9299a7]">{label}</p>
            <p className={`mt-2 text-sm font-semibold ${index === 3 ? "text-emerald-400" : "text-[#e5e7eb]"}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-white/5 px-3 py-3 text-[11px] text-[#9299a7] sm:px-4">
        <span>{rival ? `Opponent: ${name}` : `${wins} wins / ${losses} losses`}</span>
        <span>Ranked duel matchmaking</span>
      </div>
    </article>
  );
}

export function MatchFound({ onClose, onAccepted }) {
  const { user } = useAuth();
  const { pendingMatch, acceptMatch, declineMatch, hasAccepted, timeOffset } = useBattle();

  const calculateRemainingSeconds = () => {
    if (!pendingMatch?.acceptDeadline) return 30;
    const now = Date.now() + (timeOffset || 0);
    const deadline = new Date(pendingMatch.acceptDeadline).getTime();
    return Math.max(0, Math.ceil((deadline - now) / 1000));
  };

  const [seconds, setSeconds] = useState(calculateRemainingSeconds);
  const lastSoundRef = useRef(null);
  const acceptingRef = useRef(false);

  useEffect(() => {
    setSeconds(calculateRemainingSeconds());
    const timer = setInterval(() => {
      setSeconds(calculateRemainingSeconds());
    }, 500);
    return () => clearInterval(timer);
  }, [pendingMatch, timeOffset]);

  useEffect(() => {
    if (lastSoundRef.current === seconds) return;
    lastSoundRef.current = seconds;
    if (seconds === 30) playTone(880, 0.35, 0.1);
    else if (seconds > 0 && seconds <= 5) playTone(620, 0.1, 0.12);
    else if (seconds === 0) playTone(260, 0.3);
  }, [seconds]);

  const handleAccept = () => {
    if (acceptingRef.current || seconds === 0 || hasAccepted) return;
    acceptingRef.current = true;
    playTone(880);
    acceptMatch(() => {
      acceptingRef.current = false;
    });
    onAccepted?.();
  };

  const handleDecline = () => {
    declineMatch();
    onClose?.();
  };

  useEffect(() => {
    const keydown = (event) => {
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        handleAccept();
      }
      if (event.key === "Escape") {
        handleDecline();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [seconds, hasAccepted]);

  const opponent = pendingMatch?.opponent || null;
  const problem = pendingMatch?.problem || null;
  const ratingPreview = pendingMatch?.ratingPreview || { win: 32, loss: -16 };

  const winDelta = ratingPreview.win >= 0 ? `+${ratingPreview.win}` : `${ratingPreview.win}`;
  const lossDelta = `${ratingPreview.loss}`;

  return (
    <section className="match-found-screen relative isolate min-h-[calc(100vh-64px)] overflow-hidden bg-[#0d0f11] text-[#e5e7eb]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 20% 45%,#fddf4914,transparent 60%),radial-gradient(ellipse at 100% 65%,#ac253214,transparent 60%),radial-gradient(#ffffff0a 1px, transparent 1px)",
          backgroundSize: "auto,auto,24px 24px",
        }}
      />
      <div className="mx-auto flex max-w-[1080px] flex-col gap-4 px-4 py-4 sm:px-4 sm:py-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/[.06] bg-[#0c0e10] p-4">
          <div className="flex items-center gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fddf49] text-[#24200b]">
              <Swords size={23} />
            </span>
            <div>
              <h1 className="text-sm font-semibold sm:text-base">MATCH FOUND // 1V1 RANKED DUEL</h1>
              <p className="mt-1.5 text-xs text-[#9299a7]">
                Live Matchmaking <span className="mx-2">/</span> Competitive Ranked <span className="mx-2">/</span>
                <span className="text-[#fddf49]">Server Synced</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => { void playTone(880, 0.3, 0.16); }}
              className="rounded-md border border-white/10 px-2 py-1.5 text-[10px] text-[#fddf49] hover:bg-white/5"
            >
              Sound test
            </button>
            <div className="text-right">
              <p className="text-xs font-semibold text-white">
                {hasAccepted
                  ? "WAITING FOR OPPONENT"
                  : seconds === 0
                  ? "MATCH EXPIRED"
                  : "CONFIRM YOUR DUEL"}
              </p>
              <p className={`mt-1 text-[11px] ${seconds === 0 ? "text-[#dc8895]" : "text-[#9299a7]"}`}>
                {hasAccepted
                  ? "Locked in — awaiting opponent confirmation"
                  : seconds === 0
                  ? "Returning to queue..."
                  : `Accept within ${seconds}s`}
              </p>
            </div>
            <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-sm ${hasAccepted ? "border-emerald-400 text-emerald-400 animate-pulse" : "border-[#fddf49]/60 text-[#fddf49]"}`}>
              {seconds}
            </span>
          </div>
        </header>

        <div className="grid items-center gap-3 py-2 lg:grid-cols-[1fr_110px_1fr] lg:py-3">
          <PlayerCard user={user} />
          <div className="flex flex-col items-center gap-3 py-3 text-center">
            <div className="flex h-14 w-14 rotate-45 items-center justify-center rounded-lg border border-[#fddf49]/20 bg-[#282a25]">
              <b className="-rotate-45 text-xl italic text-[#fddf49]">VS</b>
            </div>
            <div className="mt-2 text-xs leading-6">
              <p className="text-[#fddf49] font-semibold">WIN: {winDelta} RR</p>
              <p className="text-[#df7787] font-semibold">LOSS: {lossDelta} RR</p>
            </div>
            <div className="text-xs">
              <p className="text-[#9299a7] uppercase tracking-wider text-[10px]">TARGET PROBLEM</p>
              <p className="mt-1 font-semibold text-white">{problem?.title || "Problem Loading..."}</p>
              <span className="mt-1 inline-block rounded bg-[#213a30] px-2 py-0.5 text-[10px] text-[#94cdb7] uppercase font-semibold">
                {problem?.difficulty || "MEDIUM"} / {problem?.category || "ALGORITHMS"}
              </span>
            </div>
          </div>
          <PlayerCard rival opponent={opponent} />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <button
            onClick={handleAccept}
            disabled={hasAccepted || seconds === 0}
            className={`flex min-h-10 items-center justify-center gap-3 rounded-lg px-4 py-2.5 text-xs font-semibold shadow-[0_0_24px_#fddf491a] transition-all ${
              hasAccepted
                ? "bg-[#234139] text-[#94cdb7] cursor-not-allowed"
                : seconds === 0
                ? "bg-white/10 text-muted cursor-not-allowed"
                : "bg-[#fddf49] text-[#24200b] hover:bg-[#ffe76e]"
            }`}
          >
            <Swords size={18} />
            {hasAccepted
              ? "LOCKED IN // WAITING FOR OPPONENT..."
              : seconds === 0
              ? "MATCH EXPIRED"
              : "LOCK IN DUEL (SPACEBAR)"}
          </button>
          <button
            onClick={handleDecline}
            disabled={hasAccepted}
            className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#9e4950]/25 bg-[#281a1e] px-5 py-2.5 text-xs font-semibold text-[#e4a1aa] hover:bg-[#341d22] transition-colors"
          >
            <X size={16} />
            DECLINE MATCH (ESC)
          </button>
        </div>

        <p className="text-center text-[10px] text-[#737c8c]">
          Competitive Ranked Duel. Declining or allowing timer to expire triggers a queue cooldown.
        </p>
      </div>
    </section>
  );
}
