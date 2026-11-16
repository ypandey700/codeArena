import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ChevronDown, Swords, Trophy, X } from "lucide-react";
import { getPlayerRank, rankRange, RANKS } from "../data/ranks";
import "./RankOverview.css";

function RankEmblem({ tier, className = "" }) {
  return (
    <svg className={`rank-emblem ${className}`} viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={{ color: tier?.color || "#9aa7b2" }}>
      <path d="M32 5L54 17L50 42L32 59L14 42L10 17Z" fill="currentColor" fillOpacity=".04" stroke="currentColor" strokeOpacity=".25" strokeWidth="1" />
      <path d="M18 14L32 7L46 14 M18 47L32 59L46 47" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.2" />
      {tier ? <path d={tier.emblem} fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /> : <path d="M27 25C27 18 39 18 39 26C39 31 32 31 32 37 M32 43V44" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

export function RankBadge({ user, onClick, expanded }) {
  const { current, rating, position } = getPlayerRank(user);
  return (
    <button type="button" className="arena-rank-trigger" onClick={onClick} aria-haspopup="dialog" aria-expanded={expanded} aria-label={`View ranked ladder. ${current?.name || "Rank unavailable"}${position ? `, arena position ${position}` : ""}${rating != null ? `, ${rating.toLocaleString()} RR` : ""}`}>
      <RankEmblem tier={current} /><span className="arena-rank-trigger__tier" style={{ color: current?.color }}>{current?.name || "Your rank"}</span>{position != null && <span className="arena-rank-trigger__position">#{position.toLocaleString()}</span>}{rating != null && <span className="arena-rank-trigger__rating">{rating.toLocaleString()} <small>RR</small></span>}<ChevronDown size={12} aria-hidden="true" />
    </button>
  );
}

export default function RankOverview({ user, onClose, returnFocusTo }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const restoreRef = useRef(returnFocusTo || document.activeElement);
  const { current, next, rating, index, progress, position } = getPlayerRank(user);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const lockHere = previousOverflow !== "hidden";
    if (lockHere) document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (lockHere) document.body.style.overflow = previousOverflow;
      if (restoreRef.current?.isConnected) restoreRef.current.focus({ preventScroll: true });
    };
  }, []);

  function handleKeyDown(event) {
    // Closing is the card's only action. Keep keyboard focus in the dialog.
    if (event.key === "Tab") { event.preventDefault(); closeRef.current?.focus(); }
  }

  return createPortal(
    <dialog ref={dialogRef} className="rank-overview" aria-labelledby="rank-overview-title" onKeyDown={handleKeyDown} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
      <div className="rank-overview__surface">
        <header className="rank-overview__header"><div><p className="rank-eyebrow"><Swords size={12} aria-hidden="true" />COMPETITIVE / RANKED 1V1</p><h2 id="rank-overview-title">Your rank. <span>Your climb.</span></h2></div><button ref={closeRef} className="rank-overview__close" type="button" aria-label="Close ranked ladder" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>

        <section className="rank-standing" aria-label="Your current standing" style={{ "--rank-color": current?.color || "#9aa7b2" }}>
          <div className="rank-standing__identity"><div className="rank-standing__crest"><RankEmblem tier={current} /></div><div><p className="rank-eyebrow">YOUR CURRENT RANK</p><h3>{current?.name || "Not available"}</h3><div className="rank-standing__numbers">{rating != null ? <strong>{rating.toLocaleString()} <small>RR</small></strong> : <span>Rating unavailable</span>}{position != null && <span className="rank-standing__position" title={`Arena position #${position.toLocaleString()}`}><Trophy size={12} aria-hidden="true" /><b>#{position.toLocaleString()}</b><span>in the arena</span></span>}</div></div></div>
          <div className="rank-progress">
            {next && rating != null ? <><div className="rank-progress__heading"><span>Next stop</span><strong>{next.name}<ArrowUpRight size={13} aria-hidden="true" /></strong></div><p><b>{Math.max(0, next.min - rating).toLocaleString()} RR</b> to the next tier</p><div className="rank-progress__track" role="progressbar" aria-label={`Progress from ${current.name} to ${next.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={`${Math.max(0, next.min - rating).toLocaleString()} RR needed to reach ${next.name}`}><span style={{ width: `${progress}%` }} /></div><div className="rank-progress__limits"><span>{current.min.toLocaleString()} RR</span><span>{next.min.toLocaleString()} RR</span></div></> : current && !next ? <><span className="rank-progress__summit"><Trophy size={16} aria-hidden="true" />HIGHEST TIER</span><strong className="rank-progress__summit-title">The summit is yours.</strong><p>Keep raising the bar. Every duel counts.</p></> : <><span className="rank-progress__summit">YOUR NEXT CHAPTER</span><strong className="rank-progress__summit-title">Find your place.</strong><p>Your rating and progress will appear when available.</p></>}
          </div>
        </section>

        <section className="rank-ladder" aria-labelledby="rank-ladder-title"><div className="rank-ladder__heading"><h3 id="rank-ladder-title">The ranked ladder</h3>{current && <span><i />You are here</span>}</div><ol>{RANKS.map((tier, tierIndex) => <li key={tier.name} className={`rank-tier${tierIndex === index ? " is-current" : ""}`} style={{ "--rank-color": tier.color }} aria-current={tierIndex === index ? "step" : undefined}><span className="rank-tier__marker" aria-hidden="true">{tierIndex === index ? "YOU" : String(tierIndex + 1).padStart(2, "0")}</span><RankEmblem tier={tier} /><h4>{tier.name}</h4><p>{rankRange(tierIndex)}<span> RR</span></p>{tierIndex === index && <span className="rank-sr-only">Your current rank</span>}</li>)}</ol></section>

        <footer className="rank-overview__footer"><span className="rank-overview__footmark"><Swords size={12} aria-hidden="true" />ONE DUEL AT A TIME.</span><p>RR determines your tier. Your arena position compares your rating with other players.</p></footer>
      </div>
    </dialog>, document.body,
  );
}
