import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Award, CalendarDays, Check, CheckCircle2, ChevronDown, CircleAlert, Code2, Copy, Flame, GraduationCap, LoaderCircle, Pencil, RotateCcw, Sparkles, Swords, Trophy, Users } from "lucide-react";
import ProfileSkiller from "./ProfileSkiller";
import "./ProfileDashboard.css";

const LANGUAGE_LABELS = { python: "Python", javascript: "JavaScript", cpp: "C++", java: "Java" };
const number = (value) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
const date = (value, options = { month: "short", year: "numeric" }) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString(undefined, options) : null;
};

export function PlayerAvatar({ user, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [user.avatar]);
  return <span className={`pp-avatar ${className}`}>{user.avatar && !failed ? <img src={user.avatar} alt={`${user.username}'s avatar`} onError={() => setFailed(true)} /> : <span aria-label={`${user.username}'s initials`}>{user.username?.slice(0, 2).toUpperCase() || "CA"}</span>}</span>;
}

function EmptyState({ title, copy, loading = false, onRetry }) {
  return <div className="pp-empty" role={loading ? "status" : undefined}>{loading ? <LoaderCircle size={19} className="pp-spin" aria-hidden="true" /> : onRetry ? <CircleAlert size={19} aria-hidden="true" /> : <Code2 size={19} aria-hidden="true" />}<div><h3>{title}</h3><p>{copy}</p></div>{onRetry && <button type="button" className="pp-text-button" onClick={onRetry}>Retry<RotateCcw size={12} aria-hidden="true" /></button>}</div>;
}

function SubmissionRow({ submission }) {
  const accepted = submission.status === "accepted";
  const statuses = { accepted: "Accepted", wrong_answer: "Wrong answer", runtime_error: "Runtime error", time_limit: "Time limit", compile_error: "Compile error" };
  const when = date(submission.createdAt, { month: "short", day: "numeric" });
  return <article className="pp-submission"><span className={`pp-submission__icon${accepted ? " is-accepted" : ""}`}>{accepted ? <CheckCircle2 size={17} aria-hidden="true" /> : <CircleAlert size={17} aria-hidden="true" />}</span><div className="pp-submission__main"><h3 title={submission.problem?.title}>{submission.problem?.title || "Code submission"}</h3><p>{LANGUAGE_LABELS[submission.language] || submission.language || "Code"}{submission.totalCount > 0 && ` · ${submission.passedCount}/${submission.totalCount} tests`}</p></div><div className="pp-submission__result"><strong className={accepted ? "is-accepted" : ""}>{statuses[submission.status] || submission.status?.replaceAll("_", " ") || "Recorded"}</strong>{when && <time dateTime={submission.createdAt}>{when}</time>}</div></article>;
}

export default function ProfileDashboard({ profileUser, isOwnProfile, recentSubmissions = [], submissionsLoading, submissionsError, onRetrySubmissions, onEdit }) {
  const [shareState, setShareState] = useState("idle");
  const shareTimer = useRef(null);
  useEffect(() => { setShareState("idle"); return () => clearTimeout(shareTimer.current); }, [profileUser.username]);
  const stats = profileUser.stats || {};
  const wins = stats.wins ?? 0, losses = stats.losses ?? 0, draws = stats.draws ?? 0;
  const totalMatches = wins + losses + draws;
  const winRate = totalMatches ? Math.round(wins / totalMatches * 100) : 0;
  const joined = date(profileUser.createdAt);
  const badges = profileUser.badges || [];
  const shareUrl = `${window.location.origin}/u/${encodeURIComponent(profileUser.username)}`;
  const languages = useMemo(() => Object.entries(recentSubmissions.reduce((counts, item) => { if (item.language) counts[item.language] = (counts[item.language] || 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1]), [recentSubmissions]);
  const copyProfile = async () => {
    clearTimeout(shareTimer.current);
    try { await navigator.clipboard.writeText(shareUrl); setShareState("copied"); shareTimer.current = setTimeout(() => setShareState("idle"), 2200); }
    catch { setShareState("manual"); }
  };

  return <div className="player-profile">
    <div className="pp-page-top"><Link to={isOwnProfile ? "/dashboard" : "/"}><ArrowLeft size={14} aria-hidden="true" />Home</Link><span>{isOwnProfile ? "Your profile" : "Player profile"}</span></div>
    <section className="pp-card" aria-labelledby="pp-player-name">
      <div className="pp-card__main">
        <div className="pp-profile-info">
          <div className="pp-person"><div className="pp-avatar-wrap"><PlayerAvatar user={profileUser} /><span className="pp-avatar-sticker" aria-hidden="true"><Code2 size={14} /></span></div><div className="pp-person__name"><span className={`pp-presence${profileUser.isOnline ? " is-online" : ""}`}><i />{profileUser.isOnline ? "Online" : "Offline"}</span><h1 id="pp-player-name">{profileUser.username}<span>.</span></h1></div></div>
          <p className={`pp-bio${!profileUser.bio ? " is-empty" : ""}`}>{profileUser.bio || "Learning. Building. Getting better."}</p>
          <div className="pp-profile-meta">{profileUser.college && <span><GraduationCap size={13} aria-hidden="true" />{profileUser.college}</span>}{joined && <span><CalendarDays size={12} aria-hidden="true" />Joined {joined}</span>}</div>
          <div className="pp-profile-actions">{isOwnProfile && <button type="button" className="pp-button" onClick={onEdit}><Pencil size={13} aria-hidden="true" />Edit profile</button>}<button type="button" className="pp-button" onClick={copyProfile}>{shareState === "copied" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{shareState === "copied" ? "Copied" : "Share"}</button></div>
        </div>
        <div className="pp-rating-card"><svg className="pp-rating-doodle" viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="m40 5 5 23 20-13-13 20 23 5-23 5 13 20-20-13-5 23-5-23-20 13 13-20-23-5 23-5-13-20 20 13Z" stroke="currentColor" strokeWidth="1.3" /><circle cx="40" cy="40" r="10" stroke="currentColor" /></svg><span>Arena rating</span><strong>{number(profileUser.rating)}<small>RR</small></strong><p>{profileUser.tier || "Arena member"}{profileUser.rank != null && <> · #{number(profileUser.rank)}</>}</p>{stats.streak > 0 && <span className="pp-streak"><Flame size={12} aria-hidden="true" />{number(stats.streak)} win streak</span>}</div>
      </div>
      <dl className="pp-quick-stats">{[{ label: "Battles", value: totalMatches, icon: Swords }, { label: "Wins", value: wins, icon: Trophy }, { label: "Solved", value: stats.problemsSolved ?? 0, icon: Code2 }, { label: "XP earned", value: profileUser.xp ?? 0, icon: Sparkles }].map(({ label, value, icon: Icon }) => <div key={label}><dt><Icon size={13} aria-hidden="true" />{label}</dt><dd>{number(value)}</dd></div>)}</dl>
      {shareState !== "idle" && <div className="pp-share-feedback" role="status">{shareState === "copied" ? "Profile link copied." : <><label htmlFor="pp-share-url">Copy profile link</label><input id="pp-share-url" readOnly value={shareUrl} onFocus={(event) => event.target.select()} /></>}</div>}
    </section>
    {isOwnProfile && <ProfileSkiller key={profileUser._id || profileUser.username} />}
    <div className="pp-more">
      {isOwnProfile && <details className="pp-disclosure pp-activity"><summary><span><Code2 size={17} aria-hidden="true" />Recent code</span><small>{submissionsLoading ? "Loading…" : `${recentSubmissions.length} submissions`}</small><ChevronDown size={16} aria-hidden="true" /></summary><div className="pp-disclosure__body">
        {submissionsLoading ? <EmptyState loading title="Loading recent submissions" copy="Your latest code will appear here." /> : submissionsError ? <EmptyState title="Activity couldn't load" copy={submissionsError} onRetry={onRetrySubmissions} /> : recentSubmissions.length ? <><div className="pp-language-tags">{languages.map(([key, count]) => <span key={key}>{LANGUAGE_LABELS[key] || key}<b>{count}</b></span>)}</div><div className="pp-submissions">{recentSubmissions.map((submission) => <SubmissionRow key={submission._id} submission={submission} />)}</div><p className="pp-footnote">Your {recentSubmissions.length} latest submissions.</p></> : <EmptyState title="Your first submission starts here" copy="Take on an arena challenge to add to your activity." />}
      </div></details>}
      <details className="pp-disclosure pp-arena-details" open={isOwnProfile ? undefined : true}><summary><span><Swords size={17} aria-hidden="true" />Arena details</span><small>{totalMatches ? `${winRate}% win rate` : "Ready for your first duel"}</small><ChevronDown size={16} aria-hidden="true" /></summary><div className="pp-disclosure__body">
        <div className="pp-record-line" aria-label={`${wins} wins, ${losses} losses, ${draws} draws`}><span><i className="is-win" />{number(wins)} wins</span><span><i className="is-loss" />{number(losses)} losses</span><span><i className="is-draw" />{number(draws)} draws</span></div>
        {totalMatches > 0 && <div className="pp-record-bar" aria-hidden="true">{[[wins, "is-win"], [losses, "is-loss"], [draws, "is-draw"]].map(([count, style]) => count > 0 && <span key={style} className={style} style={{ width: `${count / totalMatches * 100}%` }} />)}</div>}
        <dl className="pp-extra-stats"><div><dt><Trophy size={13} aria-hidden="true" />Best rating</dt><dd>{number(stats.peakRating ?? profileUser.rating)} RR</dd></div><div><dt><Flame size={13} aria-hidden="true" />Win streak</dt><dd>{number(stats.streak ?? 0)}</dd></div><div><dt><Users size={13} aria-hidden="true" />Friends</dt><dd>{number(profileUser.friends?.length ?? 0)}</dd></div></dl>
        <div className="pp-badges"><h3><Award size={15} aria-hidden="true" />Badges<span>{badges.length}</span></h3>{badges.length ? <div className="pp-badge-list">{badges.map((badge, index) => <span key={`${badge}-${index}`}><Award size={13} aria-hidden="true" />{badge.replaceAll("_", " ")}</span>)}</div> : <p>Earn your first badge as you play.</p>}</div>
      </div></details>
    </div>
    <p className="pp-page-note">A little practice goes a long way.<Sparkles size={12} aria-hidden="true" /></p>
  </div>;
}
