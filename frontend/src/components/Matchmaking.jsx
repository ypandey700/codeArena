import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import {
  ArrowRight, Check, Clock3, Code2, LoaderCircle, MessageSquare,
  Minimize2, Search, Swords, UserRound, X,
} from "lucide-react";
import "./MatchmakingQueue.css";
import "./MatchFound.css";

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

function PlayerCard({ user, rival = false, opponent = null, accepted = false }) {
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
  const [failedAvatar, setFailedAvatar] = useState(null);

  return (
    <article className={`mf-player${rival ? " mf-player--opponent" : ""}${accepted ? " is-accepted" : ""}`}>
      <div className="mf-player__heading">
        <span>{rival ? "Opponent's corner" : "Your corner"}</span>
        <span className="mf-player__badge">{accepted ? <><Check size={11} aria-hidden="true" />Accepted</> : rival ? "Rival" : "You"}</span>
      </div>
      <div className="mf-player__identity">
        <div className="mf-player__avatar">
          {avatar && failedAvatar !== avatar ? <img src={avatar} alt="" onError={() => setFailedAvatar(avatar)} /> : name.slice(0, 2).toUpperCase()}
        </div>
        <h2 title={name}>{name}</h2>
        <p className="mf-player__rank"><span>{tier}</span><strong>{displayRating} <small>RR</small></strong></p>
      </div>
      <dl className="mf-player__stats"><div><dt>Win rate</dt><dd>{winrate}</dd></div><div><dt>Win streak</dt><dd>{streak}</dd></div></dl>
      <p className="mf-player__footer">{accepted ? <Check size={13} aria-hidden="true" /> : <Swords size={13} aria-hidden="true" />}{accepted ? "You're locked in" : rival ? "Your next challenge" : "Ready to make your move?"}</p>
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
  const panelRef = useRef(null);
  const acceptButtonRef = useRef(null);
  const declineButtonRef = useRef(null);
  const acceptWindowRef = useRef(Math.max(1, calculateRemainingSeconds()));

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

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
    if (hasAccepted || seconds === 0) return;
    declineMatch();
    onClose?.();
  };

  useEffect(() => {
    const keydown = (event) => {
      if (event.defaultPrevented) return;
      const dialog = event.target instanceof Element ? event.target.closest('dialog[open], [role="dialog"][aria-modal="true"]') : null;
      if (dialog && dialog !== panelRef.current) return;
      if (event.key === "Tab") {
        const first = acceptButtonRef.current;
        const last = declineButtonRef.current;
        if (!first || first.disabled || !last || last.disabled) {
          event.preventDefault();
          panelRef.current?.focus({ preventScroll: true });
        } else if (!panelRef.current?.contains(document.activeElement) || document.activeElement === panelRef.current) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleDecline();
        return;
      }
      if (event.target instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName) || event.target.isContentEditable)) return;
      if (event.code === "Space") {
        event.preventDefault();
        handleAccept();
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
    <section ref={panelRef} className={`match-found-screen arena-page-background${hasAccepted ? " is-accepted" : ""}${seconds <= 5 && !hasAccepted ? " is-urgent" : ""}`} role="dialog" aria-modal="true" aria-labelledby="match-found-heading" aria-describedby="match-found-description" tabIndex={-1}>
      <div className="mf-wrap">
        <header className="mf-header">
          <div className="mf-header__label"><Swords size={18} aria-hidden="true" /><span>Live matchmaking</span><span className="mf-mode">Ranked 1v1</span></div>
          <span className="mf-found"><Check size={12} aria-hidden="true" />Opponent found</span>
        </header>

        <div className="mf-intro">
          <div><p className="mf-eyebrow">Your next challenge is here</p><h1 id="match-found-heading">Match found.<br /><em>Make your move.</em></h1><p id="match-found-description">Accept your duel. The arena opens when you both lock in.</p></div>
          <div className="mf-countdown">
            <div className="mf-countdown__ring" role="timer" aria-label={`${seconds} seconds remaining to accept`}>
              <svg viewBox="0 0 80 80" aria-hidden="true"><circle className="mf-countdown__track" cx="40" cy="40" r="34" /><circle className="mf-countdown__progress" cx="40" cy="40" r="34" pathLength="100" strokeDasharray={`${Math.min(1, seconds / acceptWindowRef.current) * 100} 100`} /></svg>
              {hasAccepted ? <Check size={26} aria-hidden="true" /> : <span>{seconds}<small>seconds</small></span>}
            </div>
            <div className="mf-countdown__copy" role="status"><strong>{hasAccepted ? "You're locked in" : seconds === 0 ? "Time's up" : "Your move"}</strong><p>{hasAccepted ? "Waiting for your opponent…" : seconds === 0 ? "The acceptance window has closed." : "Accept before the timer runs out."}</p></div>
          </div>
        </div>

        <div className="mf-matchup">
          <PlayerCard user={user} accepted={hasAccepted} />
          <div className="mf-versus" aria-label="versus"><span><Swords size={24} aria-hidden="true" /></span><b>VS</b><i /></div>
          <PlayerCard rival opponent={opponent} />
        </div>

        <div className="mf-brief" aria-label="Duel details">
          <div className="mf-problem"><span className="mf-problem__icon"><Code2 size={19} aria-hidden="true" /></span><div><small>Your challenge</small><strong>{problem?.title || "Preparing your challenge"}</strong></div>{problem?.difficulty && <span className={`mf-difficulty mf-difficulty--${problem.difficulty}`}>{problem.difficulty}</span>}</div>
          <dl className="mf-stakes"><div><dt>On a win</dt><dd>{winDelta} <small>RR</small></dd></div><div><dt>On a loss</dt><dd>{lossDelta} <small>RR</small></dd></div></dl>
        </div>

        <footer className="mf-footer">
          <div className="mf-actions">
            <button ref={acceptButtonRef} type="button" className="mf-accept" onClick={handleAccept} disabled={hasAccepted || seconds === 0} aria-keyshortcuts="Space">{hasAccepted ? <LoaderCircle size={17} className="mf-spinner" aria-hidden="true" /> : <Swords size={17} aria-hidden="true" />}{hasAccepted ? "Waiting for opponent" : seconds === 0 ? "Match expired" : "Accept duel"}{!hasAccepted && seconds > 0 && <kbd>Space</kbd>}</button>
            <button ref={declineButtonRef} type="button" className="mf-decline" onClick={handleDecline} disabled={hasAccepted || seconds === 0} aria-keyshortcuts="Escape"><X size={15} aria-hidden="true" />Decline<kbd>Esc</kbd></button>
          </div>
          <p>Declining or missing this duel starts a short queue cooldown.</p>
        </footer>
      </div>
    </section>
  );
}
