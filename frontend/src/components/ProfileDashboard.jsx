import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Award, CalendarDays, Check,
  CheckCircle2, CircleAlert, Code2, Copy, Flame, GraduationCap,
  Layers, LoaderCircle, LockKeyhole, Pencil, RotateCcw, ShieldCheck,
  Sparkles, Swords, Target, Trophy, Users,
} from "lucide-react";
import "./ProfileDashboard.css";

const LANGUAGE_LABELS = { python: "Python", javascript: "JavaScript", cpp: "C++", java: "Java" };
const LANGUAGE_COLORS = { python: "#e4ce74", javascript: "#a6c6ad", cpp: "#9dbbcc", java: "#c4abce" };
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

function PlayerCrest() {
  return <svg className="pp-crest" viewBox="0 0 280 240" fill="none" aria-hidden="true" focusable="false"><circle cx="140" cy="120" r="108" stroke="#fddf4920" /><circle cx="140" cy="120" r="94" stroke="#fddf491e" strokeDasharray="2 9" /><path d="M140 4v18m0 196v18M24 120h18m196 0h18" stroke="#fddf4940" /><path d="m140 34 70 26v61c0 43-35 65-70 85-35-20-70-42-70-85V60Z" fill="#fddf4904" stroke="#e1ce7045" /><path d="m140 47 58 22v52c0 34-28 54-58 72-30-18-58-38-58-72V69Z" stroke="#e1ce7019" /><path d="m119 97-22 23 22 23m42-46 22 23-22 23M151 84l-22 72" stroke="#d9c875" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><path d="m46 37 7-7m181 180-7 7M46 203l7 7m174-180 7 7" stroke="#fddf4928" strokeWidth="2" /></svg>;
}

function ProfileStat({ label, value, detail, icon: Icon, accent }) {
  return <article className={`pp-stat${accent ? " pp-stat--accent" : ""}`}><div><span>{label}</span><Icon size={16} aria-hidden="true" /></div><strong>{value}</strong><p>{detail}</p></article>;
}

function EmptyState({ icon: Icon = Layers, title, copy, loading = false, onRetry }) {
  return <div className="pp-empty" role={loading || onRetry ? "status" : undefined}><span className="pp-empty__icon">{loading ? <LoaderCircle size={24} className="pp-spin" aria-hidden="true" /> : <Icon size={25} strokeWidth={1.3} aria-hidden="true" />}</span><h3>{title}</h3><p>{copy}</p>{onRetry && <button type="button" className="pp-text-button" onClick={onRetry}>Try again <RotateCcw size={12} aria-hidden="true" /></button>}</div>;
}

function RecordChart({ wins, losses, draws }) {
  const total = wins + losses + draws;
  const rate = total ? Math.round(wins / total * 1000) / 10 : 0;
  const circumference = 2 * Math.PI * 64;
  let offset = 0;
  const segments = [{ value: wins, color: "#dcca76" }, { value: losses, color: "#b8837e" }, { value: draws, color: "#849cae" }].map((item) => {
    const length = total ? item.value / total * circumference : 0;
    const result = { ...item, length, offset };
    offset += length;
    return result;
  });
  return <div className="pp-record-chart" role="img" aria-label={`${wins} wins, ${losses} losses, ${draws} draws. ${rate}% win rate.`}><svg viewBox="0 0 160 160" fill="none" aria-hidden="true"><circle cx="80" cy="80" r="75" stroke="#ffffff07" /><circle cx="80" cy="80" r="64" stroke="#ffffff0b" strokeWidth="7" /><g transform="rotate(-90 80 80)">{segments.filter((item) => item.length > 0).map((item) => <circle key={item.color} cx="80" cy="80" r="64" stroke={item.color} strokeWidth="7" strokeDasharray={`${item.length} ${circumference - item.length}`} strokeDashoffset={-item.offset} />)}</g></svg><div aria-hidden="true"><strong>{rate}<small>%</small></strong><span>WIN RATE</span></div></div>;
}

function SubmissionRow({ submission }) {
  const accepted = submission.status === "accepted";
  const statuses = { accepted: "Accepted", wrong_answer: "Wrong answer", runtime_error: "Runtime error", time_limit: "Time limit", compile_error: "Compile error" };
  const when = date(submission.createdAt, { month: "short", day: "numeric" });
  const hasTests = typeof submission.passedCount === "number" && submission.totalCount > 0;
  return <article className="pp-submission"><span className={`pp-submission__icon${accepted ? " is-accepted" : ""}`}>{accepted ? <CheckCircle2 size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}</span><div className="pp-submission__main"><h3 title={submission.problem?.title}>{submission.problem?.title || "Code submission"}</h3><p><span>{LANGUAGE_LABELS[submission.language] || submission.language || "Language unavailable"}</span>{hasTests && <><i />{submission.passedCount}/{submission.totalCount} tests</>}{typeof submission.executionTimeMs === "number" && <><i />{number(submission.executionTimeMs)} ms</>}</p></div><div className="pp-submission__result"><strong className={accepted ? "is-accepted" : ""}>{statuses[submission.status] || submission.status?.replaceAll("_", " ") || "Recorded"}</strong>{when && <time dateTime={submission.createdAt}>{when}</time>}</div></article>;
}

export default function ProfileDashboard({ profileUser, isOwnProfile, recentSubmissions = [], submissionsLoading, submissionsError, onRetrySubmissions, onEdit }) {
  const [shareState, setShareState] = useState("idle");
  const shareTimer = useRef(null);
  useEffect(() => { setShareState("idle"); return () => clearTimeout(shareTimer.current); }, [profileUser.username]);
  const stats = profileUser.stats || {};
  const wins = stats.wins ?? 0, losses = stats.losses ?? 0, draws = stats.draws ?? 0;
  const totalMatches = wins + losses + draws;
  const winRate = totalMatches ? Math.round(wins / totalMatches * 1000) / 10 : 0;
  const joined = date(profileUser.createdAt);
  const lastSeen = date(profileUser.lastSeen, { month: "short", day: "numeric", year: "numeric" });
  const friends = profileUser.friends?.length ?? 0;
  const badges = profileUser.badges || [];
  const shareUrl = `${window.location.origin}/u/${encodeURIComponent(profileUser.username)}`;
  const languages = useMemo(() => {
    const counts = recentSubmissions.reduce((map, item) => { if (item.language) map[item.language] = (map[item.language] || 0) + 1; return map; }, {});
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count, percent: count / total * 100 }));
  }, [recentSubmissions]);
  const copyProfile = async () => {
    clearTimeout(shareTimer.current);
    try { await navigator.clipboard.writeText(shareUrl); setShareState("copied"); shareTimer.current = setTimeout(() => setShareState("idle"), 2200); }
    catch { setShareState("manual"); }
  };

  return (
    <div className="player-profile">
      <div className="pp-page-top"><Link to={isOwnProfile ? "/dashboard" : "/"}><ArrowLeft size={13} aria-hidden="true" />Back to {isOwnProfile ? "Command Deck" : "the arena"}</Link><p className="pp-eyebrow"><span />{isOwnProfile ? "YOUR PLAYER CARD" : "MEET THE CHALLENGER"}</p></div>
      <section className="pp-passport" aria-labelledby="pp-player-name">
        <div className="pp-passport__cover"><div><p className="pp-eyebrow"><ShieldCheck size={14} aria-hidden="true" />CODE ARENA / PLAYER FILE</p><span className="pp-passport__motto">A story written<br />one <em>duel at a time.</em></span></div><PlayerCrest /><span className={`pp-presence${profileUser.isOnline ? " is-online" : ""}`}><span />{profileUser.isOnline ? "In the arena" : lastSeen ? `Last seen ${lastSeen}` : "Offline"}</span></div>
        <div className="pp-identity"><div className="pp-identity__main"><div className="pp-avatar-wrap"><PlayerAvatar user={profileUser} /><span className="pp-avatar-wrap__mark"><Code2 size={12} aria-hidden="true" /></span></div><div className="pp-identity__text"><div className="pp-identity__tier"><span>{profileUser.tier || "Arena member"}</span>{profileUser.rank != null && <span>#{number(profileUser.rank)} in the arena</span>}</div><h1 id="pp-player-name">{profileUser.username}<span>.</span></h1><div className="pp-identity__meta">{profileUser.college && <span><GraduationCap size={13} aria-hidden="true" />{profileUser.college}</span>}{joined && <span><CalendarDays size={12} aria-hidden="true" />Joined {joined}</span>}<span><Users size={12} aria-hidden="true" />{number(friends)} {friends === 1 ? "friend" : "friends"}</span></div></div></div><div className="pp-identity__actions">{isOwnProfile && <button type="button" className="pp-button pp-button--primary" onClick={onEdit}><Pencil size={13} aria-hidden="true" />Edit player card</button>}<button type="button" className={`pp-button${!isOwnProfile ? " pp-button--primary" : ""}`} onClick={copyProfile}>{shareState === "copied" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{shareState === "copied" ? "Link copied" : "Share profile"}</button></div></div>
        <div className="pp-passport__bottom"><p className={`pp-bio${!profileUser.bio ? " is-empty" : ""}`}>{profileUser.bio || (isOwnProfile ? "A few words can say a lot. Add your story to your player card." : "Letting the code do the talking.")}</p><div className="pp-rating"><span>ARENA RATING</span><strong>{number(profileUser.rating)}<small>RR</small></strong></div></div>
        {shareState !== "idle" && <div className="pp-share-feedback" role="status">{shareState === "copied" ? "Your public profile link is ready to share." : <><label htmlFor="pp-share-url">Copy your profile link:</label><input id="pp-share-url" readOnly value={shareUrl} onFocus={(event) => event.target.select()} /></>}</div>}
      </section>

      <section className="pp-stats" aria-label="Player statistics"><ProfileStat label="Battles played" value={number(totalMatches)} detail={`${number(wins)} wins · ${number(losses)} losses · ${number(draws)} draws`} icon={Swords} /><ProfileStat label="Problems solved" value={number(stats.problemsSolved ?? 0)} detail={`${number(stats.submissions ?? 0)} total submissions`} icon={Code2} /><ProfileStat label="Current streak" value={number(stats.streak ?? 0)} detail="Consecutive wins" icon={Flame} /><ProfileStat label="Experience earned" value={<>{number(profileUser.xp ?? 0)}<small>XP</small></>} detail="Every line counts." icon={Sparkles} accent /></section>

      <div className="pp-content-grid">
        <section className="pp-panel pp-activity" aria-labelledby="pp-activity-title"><div className="pp-section-heading"><div><p className="pp-eyebrow">THE WORK BEHIND THE WINS</p><h2 id="pp-activity-title">The latest moves<span>.</span></h2></div><span className="pp-section-icon"><Layers size={18} aria-hidden="true" /></span></div>
          {!isOwnProfile ? <EmptyState icon={LockKeyhole} title="Some moves stay private." copy="Submission history is only visible to the player who wrote the code." /> : submissionsLoading ? <EmptyState loading title="Gathering your code activity…" copy="Your recent submissions are on their way." /> : submissionsError ? <EmptyState icon={CircleAlert} title="Your activity couldn't load." copy="Your record is still yours. Give it another try." onRetry={onRetrySubmissions} /> : recentSubmissions.length ? <><div className="pp-submissions">{recentSubmissions.map((submission) => <SubmissionRow key={submission._id} submission={submission} />)}</div><p className="pp-panel__footnote">Showing {recentSubmissions.length} recent {recentSubmissions.length === 1 ? "submission" : "submissions"}. Every attempt is part of the story.</p></> : <EmptyState icon={Code2} title="The first line is yours." copy="No submissions yet. Take on a ranked challenge and your code activity will find a home here." />}
        </section>

        <section className="pp-panel pp-record" aria-labelledby="pp-record-title"><div className="pp-section-heading"><div><p className="pp-eyebrow">THE BIGGER PICTURE</p><h2 id="pp-record-title">A record of your own<span>.</span></h2></div><Target size={18} className="pp-gold" aria-hidden="true" /></div><div className="pp-record__body"><RecordChart wins={wins} losses={losses} draws={draws} /><dl className="pp-record__legend">{[{ label: "Wins", value: wins, type: "wins" }, { label: "Losses", value: losses, type: "losses" }, { label: "Draws", value: draws, type: "draws" }].map((item) => <div key={item.label}><dt><span className={`pp-record__dot pp-record__dot--${item.type}`} />{item.label}</dt><dd>{number(item.value)}</dd></div>)}</dl></div><div className="pp-record__peak"><span><Trophy size={14} aria-hidden="true" />Personal best</span><strong>{number(stats.peakRating ?? profileUser.rating)}<small>RR</small></strong></div><p className="pp-panel__footnote">{totalMatches ? `${number(totalMatches)} ${totalMatches === 1 ? "battle" : "battles"} played. ${winRate}% won. Keep writing the story.` : "Every record starts somewhere. This one's just getting started."}</p></section>

        <section className="pp-panel pp-toolkit" aria-labelledby="pp-toolkit-title"><div className="pp-section-heading"><div><p className="pp-eyebrow">DIFFERENT TOOLS. YOUR APPROACH.</p><h2 id="pp-toolkit-title">The language of your game<span>.</span></h2></div><Code2 size={18} className="pp-muted" aria-hidden="true" /></div>
          {!isOwnProfile ? <EmptyState icon={LockKeyhole} title="Their toolkit stays personal." copy="Language activity is based on private submission history." /> : submissionsLoading ? <EmptyState loading title="Reading your recent activity…" copy="Your language mix will appear here." /> : submissionsError ? <EmptyState icon={CircleAlert} title="Your toolkit is taking a moment." copy="Reload recent activity to see your language mix." onRetry={onRetrySubmissions} /> : languages.length ? <><div className="pp-language-stack" aria-hidden="true">{languages.map((language) => <span key={language.key} style={{ width: `${language.percent}%`, backgroundColor: LANGUAGE_COLORS[language.key] || "#a3b3bb" }} />)}</div><div className="pp-languages">{languages.map((language) => <div className="pp-language" key={language.key}><span className="pp-language__dot" style={{ backgroundColor: LANGUAGE_COLORS[language.key] || "#a3b3bb" }} /><strong>{LANGUAGE_LABELS[language.key] || language.key}</strong><span>{language.count} {language.count === 1 ? "submission" : "submissions"}</span><b>{Math.round(language.percent)}%</b></div>)}</div><p className="pp-panel__footnote">A snapshot of your {recentSubmissions.length} latest submissions, not your entire history.</p></> : <EmptyState icon={Code2} title="Find your favourite way to build." copy="Your language mix appears after you submit code. Python, JavaScript, C++, and Java are supported." />}
        </section>

        <section className="pp-panel pp-badges" aria-labelledby="pp-badges-title"><div className="pp-section-heading"><div><p className="pp-eyebrow">LEAVE YOUR MARK</p><h2 id="pp-badges-title">Earned, not given<span>.</span></h2></div><span className="pp-badge-count">{badges.length} unlocked</span></div>{badges.length ? <div className="pp-badge-list">{badges.map((badge, index) => <article key={`${badge}-${index}`}><span className="pp-badge-emblem"><Award size={24} strokeWidth={1.4} aria-hidden="true" /></span><div><h3>{badge.replaceAll("_", " ")}</h3><p>Arena achievement</p></div></article>)}</div> : <EmptyState icon={Award} title="Room for your first milestone." copy="No badges unlocked yet. Your earned achievements will live right here." />}</section>
      </div>

      <section className="pp-rivals"><div className="pp-rivals__art" aria-hidden="true"><Swords size={28} strokeWidth={1.2} /><span /></div><div><p className="pp-eyebrow">GOOD RIVALS. BETTER STORIES.</p><h2>Some rivalries are worth keeping.</h2><p>Direct challenges, friend requests, and spectating are <strong>Coming soon.</strong></p></div><span className="pp-soon">Coming soon</span></section>
    </div>
  );
}
