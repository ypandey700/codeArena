import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import {
  ArrowRight, Check, Clock3, Code2, LoaderCircle, MessageSquare,
  Minimize2, Search, Swords, UserRound, X,
} from "lucide-react";
import "./MatchmakingQueue.css";

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
  const { queueTime, leaveQueue, setDuelState } = useBattle();
  const panelRef = useRef(null);
  const minimizeRef = useRef(null);
  const cancelRef = useRef(null);
  const [failedAvatar, setFailedAvatar] = useState(null);
  const username = user?.username || "You";
  const hasRating = user?.rating != null && Number.isFinite(Number(user.rating));
  const elapsed = Number.isFinite(queueTime) ? Math.max(0, Math.floor(queueTime)) : 0;
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  const handleClose = useCallback(() => {
    leaveQueue();
    onClose?.();
  }, [leaveQueue, onClose]);

  const handleMinimize = () => {
    setDuelState("minimized");
    onMinimize?.();
  };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    const keydown = (event) => {
      if (event.defaultPrevented || (event.target instanceof Element && event.target.closest("dialog[open]"))) return;
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
      if (event.key === "Tab") {
        const first = minimizeRef.current;
        const last = cancelRef.current;
        if (!panelRef.current?.contains(document.activeElement) || document.activeElement === panelRef.current) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [handleClose]);

  return (
    <section ref={panelRef} className="matchmaking-queue arena-page-background" role="dialog" aria-modal="true" aria-labelledby="queue-heading" aria-describedby="queue-description" tabIndex={-1}>
      <div className="mq-wrap">
        <header className="mq-header">
          <div className="mq-header__label"><Swords size={18} aria-hidden="true" /><span>Live matchmaking</span><span className="mq-mode">Ranked 1v1</span></div>
          <button ref={minimizeRef} type="button" className="mq-minimize" onClick={handleMinimize}><Minimize2 size={15} aria-hidden="true" />Minimize</button>
        </header>

        <div className="mq-intro">
          <div>
            <p className="mq-eyebrow"><span />The search is on</p>
            <h1 id="queue-heading">Your next rival.<br /><em>One search away.</em></h1>
            <p id="queue-description">A new challenge is on the horizon. Stay ready to accept your duel.</p>
          </div>
          <div className="mq-timer"><span><Clock3 size={13} aria-hidden="true" />Time in queue</span><span className="mq-timer__value" role="timer" aria-label={`${Math.floor(elapsed / 60)} minutes, ${elapsed % 60} seconds in queue`}>{minutes}<b>:</b>{seconds}</span><small>We’ll let you know when there’s a match.</small></div>
        </div>

        <div className="mq-matchup">
          <article className="mq-player">
            <div className="mq-card-heading"><span>Your corner</span><span className="mq-ready"><Check size={12} aria-hidden="true" />In queue</span></div>
            <div className="mq-avatar">
              {user?.avatar && failedAvatar !== user.avatar ? <img src={user.avatar} alt="" onError={() => setFailedAvatar(user.avatar)} /> : username.slice(0, 2).toUpperCase()}
            </div>
            <h2 title={username}>{username}</h2>
            {(user?.tier || hasRating) && <p className="mq-player__rank">{user?.tier && <span>{user.tier}</span>}{hasRating && <strong>{Number(user.rating).toLocaleString()} <small>RR</small></strong>}</p>}
            <div className="mq-player__footer"><Code2 size={15} aria-hidden="true" /><span>Ready for a new challenge</span></div>
          </article>

          <div className="mq-signal" aria-hidden="true">
            <div className="mq-radar"><span className="mq-radar__ring mq-radar__ring--outer" /><span className="mq-radar__ring mq-radar__ring--middle" /><span className="mq-radar__ring mq-radar__ring--inner" /><span className="mq-radar__sweep" /><span className="mq-radar__core"><Swords size={30} strokeWidth={1.5} /></span></div>
            <span className="mq-signal__caption">Finding your next duel<span>•••</span></span>
          </div>

          <article className="mq-opponent" aria-labelledby="queue-opponent-heading">
            <div className="mq-card-heading"><span>Opponent’s corner</span><Search size={14} aria-hidden="true" /></div>
            <div className="mq-opponent__avatar" aria-hidden="true"><UserRound size={32} strokeWidth={1.3} /><span><Search size={13} /></span></div>
            <h2 id="queue-opponent-heading" role="status"><LoaderCircle size={15} className="mq-spin" aria-hidden="true" />Searching for an opponent</h2>
            <p>Your rival will appear here<br />once a match is found.</p>
            <div className="mq-opponent__footer"><span />Still looking. Stay sharp.</div>
          </article>
        </div>

        <ol className="mq-steps" aria-label="Duel stages">
          <li className="mq-steps__active" aria-current="step"><span className="mq-step-icon"><Search size={17} aria-hidden="true" /></span><div><small>01 · Right now</small><strong>Find your opponent</strong></div><ArrowRight size={15} className="mq-step-arrow" aria-hidden="true" /></li>
          <li><span className="mq-step-icon"><Swords size={17} aria-hidden="true" /></span><div><small>02 · Up next</small><strong>Accept your duel</strong></div><ArrowRight size={15} className="mq-step-arrow" aria-hidden="true" /></li>
          <li><span className="mq-step-icon"><MessageSquare size={17} aria-hidden="true" /></span><div><small>03 · Bring your best</small><strong>Code + AI interview</strong></div></li>
        </ol>

        <footer className="mq-footer"><p>You can minimize this screen and keep exploring.<br /><span>Your search will continue in the background.</span></p><button ref={cancelRef} type="button" className="mq-cancel" onClick={handleClose} aria-keyshortcuts="Escape"><X size={15} aria-hidden="true" />Cancel search<kbd>Esc</kbd></button></footer>
      </div>
    </section>
  );
}

function PlayerCard({ user, rival = false, opponent = null }) {
  const name = rival ? (opponent?.username || "Opponent") : (user?.username || "You");
  const wins = Number(user?.stats?.wins || 0);
  const losses = Number(user?.stats?.losses || 0);
  const userRating = Number(user?.rating ?? 1200);
  const oppRating = Number(opponent?.rating ?? 1200);

  const displayRating = rival ? oppRating.toLocaleString() : userRating.toLocaleString();
  const tier = rival ? (opponent?.tier || "Unranked") : (user?.tier || "Unranked");
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
    <section className="match-found-screen arena-page-background relative isolate min-h-[calc(100vh-64px)] overflow-hidden text-[#e5e7eb]">
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
