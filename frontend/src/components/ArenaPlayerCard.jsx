import { useState } from "react";
import { Award, ChevronRight, Code2, GraduationCap, LoaderCircle, RotateCcw, Swords, Trophy } from "lucide-react";

export function ArenaAvatar({ player, className = "" }) {
  const [failed, setFailed] = useState(null);
  return <span className={`ba-player-avatar ${className}`}>
    {player?.avatar && failed !== player.avatar ? <img src={player.avatar} alt="" onError={() => setFailed(player.avatar)} /> : (player?.username || "?").slice(0, 2).toUpperCase()}
  </span>;
}

export function ArenaPlayerButton({ player, own, progress, loading, onClick }) {
  const badges = Array.isArray(player?.badges) ? player.badges : [];
  return (
    <button type="button" className={`ba-contender ${own ? "ba-contender--you" : "ba-contender--opponent"}`} onClick={onClick} aria-label={`View ${own ? "your" : `${player?.username || "opponent"}'s`} player card`} aria-haspopup="dialog">
      <ArenaAvatar player={player} />
      <span className="ba-contender__details">
        <strong>{own && <small>You</small>}<span title={player?.username}>{player?.username || "Opponent"}</span>{badges.length > 0 && <span className="ba-contender__badges" title={`${badges.length} achievements`}><Award size={11} aria-hidden="true" />{badges.length}</span>}</strong>
        <span className="ba-contender__college" title={player?.college || undefined}><GraduationCap size={11} aria-hidden="true" />{player?.college || (loading ? "Loading player info…" : "View player card")}</span>
        <span className="ba-contender__progress">{progress}</span>
      </span>
      <ChevronRight className="ba-contender__chevron" size={13} aria-hidden="true" />
    </button>
  );
}

export default function ArenaPlayerCard({ player, loading, error, onRetry }) {
  const stats = player?.stats || {};
  const badges = Array.isArray(player?.badges) ? player.badges : [];
  return (
    <div className="ba-player-card">
      <div className="ba-player-card__identity"><ArenaAvatar player={player} /><div><span>{player?.tier || "Arena player"}{player?.rating != null && ` · ${player.rating.toLocaleString()} RR`}</span><h3>{player?.username || "Opponent"}</h3></div></div>
      {loading ? <p className="ba-player-card__notice" role="status"><LoaderCircle size={15} className="ba-spin" aria-hidden="true" />Loading player details…</p> : error ? <div className="ba-player-card__notice" role="status"><p>Player details couldn’t load.</p><button type="button" className="ba-text-button" onClick={onRetry}><RotateCcw size={13} aria-hidden="true" />Try again</button></div> : <>
        <p className="ba-player-card__college"><GraduationCap size={17} aria-hidden="true" />{player?.college || "College not added"}</p>
        {player?.bio && <p className="ba-player-card__bio">{player.bio}</p>}
        <dl className="ba-player-card__stats">{[
          [Swords, "Duel wins", stats.wins ?? 0], [Code2, "Problems solved", stats.problemsSolved ?? 0],
          [Trophy, "Best rating", stats.peakRating ?? player?.rating ?? 0], [Award, "Experience", `${(player?.xp ?? 0).toLocaleString()} XP`],
        ].map(([Icon, label, value]) => <div key={label}><dt><Icon size={13} aria-hidden="true" />{label}</dt><dd>{typeof value === "number" ? value.toLocaleString() : value}</dd></div>)}</dl>
        <section className="ba-player-card__achievements" aria-label="Player achievements"><h3><Award size={16} aria-hidden="true" />Achievements<span>{badges.length}</span></h3>{badges.length ? <ul>{badges.map((badge, index) => <li key={`${badge}-${index}`}><Award size={17} aria-hidden="true" /><span>{String(badge).replaceAll("_", " ")}</span></li>)}</ul> : <p>No achievements unlocked yet.</p>}</section>
      </>}
    </div>
  );
}
