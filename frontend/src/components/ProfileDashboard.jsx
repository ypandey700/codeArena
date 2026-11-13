import { useMemo, useState } from "react";
import {
  Activity,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock3,
  Code2,
  Copy,
  Database,
  GraduationCap,
  ShieldCheck,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

const LANGUAGE_LABELS = {
  python: "Python 3",
  javascript: "JavaScript",
  cpp: "C++",
  java: "Java",
};

export default function ProfileDashboard({ profileUser, isOwnProfile, recentSubmissions, submissionsLoading, onEdit }) {
  const [copied, setCopied] = useState(false);
  const stats = profileUser.stats || {};
  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const solved = stats.problemsSolved || 0;
  const submissionCount = stats.submissions || 0;
  const totalMatches = wins + losses;
  const winRate = totalMatches ? Math.round((wins / totalMatches) * 1000) / 10 : 0;
  const rating = profileUser.rating ?? 1200;
  const xp = profileUser.xp || 0;
  const level = Math.floor(xp / 500) + 1;
  const currentLevelXp = xp % 500;
  const levelProgress = Math.min(100, (currentLevelXp / 500) * 100);
  const friendsCount = profileUser.friends?.length || 0;
  const joined = profileUser.createdAt
    ? new Date(profileUser.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "—";
  const lastSeen = profileUser.lastSeen
    ? new Date(profileUser.lastSeen).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Recently";

  const languages = useMemo(() => {
    const counts = recentSubmissions.reduce((result, submission) => {
      const key = submission.language;
      if (key) result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return entries.map(([key, count]) => ({ key, count, percent: total ? Math.round((count / total) * 100) : 0 }));
  }, [recentSubmissions]);

  const averageRuntime = recentSubmissions.length
    ? (recentSubmissions.reduce((sum, item) => sum + (item.executionTimeMs || 0), 0) / recentSubmissions.length).toFixed(1)
    : null;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="profile-dashboard mx-auto w-full max-w-[1280px] px-4 pb-8 pt-6 sm:px-6">
      <section className="relative overflow-hidden rounded-lg border border-white/[.06] bg-[#16191c]">
        <div className="profile-hero-cover relative h-28 overflow-hidden sm:h-36">
          <div className="absolute inset-0 bg-gradient-to-t from-[#18191b] via-[#18191b]/35 to-transparent" />
          <div className="absolute right-5 top-5 flex items-center gap-2 rounded-md border border-white/[.08] bg-[#16191c]/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant backdrop-blur-sm sm:right-8">
            <span className={`h-2 w-2 rounded-full ${profileUser.isOnline ? "animate-pulse bg-primary" : "bg-[#6B7280]"}`} />
            {profileUser.isOnline ? "Arena presence active" : `Last seen ${lastSeen}`}
          </div>
        </div>

        <div className="relative -mt-10 px-4 pb-5 sm:-mt-12 sm:px-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
              <div className="relative h-20 w-20 shrink-0 rounded-lg border border-primary/60 bg-[#16191c] p-1 shadow-[0_0_24px_rgba(197,161,122,.13)] sm:h-24 sm:w-24">
                {profileUser.avatar ? (
                  <img src={profileUser.avatar} alt={`${profileUser.username}'s avatar`} className="h-full w-full rounded-md object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-md bg-[#0d1115] text-2xl font-semibold uppercase text-[#fddf49]">{profileUser.username.charAt(0)}</div>
                )}
                <span className="absolute -bottom-2 -right-2 flex items-center gap-1 rounded-sm bg-primary px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-[#261f18]"><Trophy size={11} /> Arena member</span>
              </div>

              <div className="min-w-0 pb-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-[#24292f] px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#fddf49]"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Code Arena</span>
                  <span className="rounded-sm bg-[#16191c] px-2 py-1 text-[9px] font-semibold text-on-surface-variant">{isOwnProfile ? "Your profile" : "Player profile"}</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h1 className="break-all text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">{profileUser.username}</h1>
                  <span className="font-mono text-sm text-muted">{rating} RR</span>
                </div>
                {profileUser.bio && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-on-surface-variant">{profileUser.bio}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-muted">
                  {profileUser.college && <span className="inline-flex items-center gap-1.5"><GraduationCap size={13} />{profileUser.college}</span>}
                  <span className="inline-flex items-center gap-1.5"><Calendar size={12} />Joined {joined}</span>
                  <span className="inline-flex items-center gap-1.5"><Users size={12} />{friendsCount} {friendsCount === 1 ? "friend" : "friends"}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {isOwnProfile && <button type="button" onClick={onEdit} className="order-1 inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-[#16191c] px-3.5 text-xs font-semibold text-on-surface transition hover:border-primary/30 hover:text-[#fddf49]"><Code2 size={14} />Edit profile</button>}
              <button type="button" disabled title="Live duels are not available yet" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-[#261f18] opacity-75"><Swords size={16} />Challenge to 1v1 duel</button>
              <button type="button" disabled title="Live spectating is not available yet" className="inline-flex h-9 items-center gap-2 rounded-md bg-[#16191c] px-3.5 text-xs font-semibold text-on-surface-variant opacity-70"><Activity size={15} />Spectate Live</button>
              {!isOwnProfile && <button type="button" disabled title="Friend requests are coming soon" className="flex h-9 w-9 items-center justify-center rounded-md bg-[#16191c] text-on-surface-variant opacity-70" aria-label="Add friend"><UserPlus size={17} /></button>}
              <button type="button" onClick={handleShare} className="flex h-9 w-9 items-center justify-center rounded-md bg-[#16191c] text-on-surface-variant transition hover:text-[#fddf49]" aria-label="Copy profile link"><Copy size={15} /></button>
              {copied && <span role="status" className="text-[10px] text-[#fddf49]">Link copied</span>}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:gap-3">
            <TelemetryCard label="Win rate" value={`${winRate}%`} detail={`${wins}W – ${losses}L (${totalMatches} total)`} icon={BarChart3} />
            <TelemetryCard label="Arena level" value={`Level ${level}`} detail={`${currentLevelXp} / 500 XP this level`} icon={Zap} highlight />
            <TelemetryCard label="Submissions" value={submissionCount.toLocaleString()} detail={`${solved.toLocaleString()} problems solved`} icon={Database} />
            <TelemetryCard label="Arena MMR" value={`${rating.toLocaleString()} RR`} detail="Current rating" icon={Trophy} highlight />
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.8fr_.9fr]">
        <section className="rounded-lg border border-white/[.06] bg-[#16191c] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-on-surface sm:text-base">Arena Progression</h2><p className="mt-1 text-[10px] text-muted">Current MMR and experience level</p></div>
            <span className="rounded-sm bg-[#fddf49]/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#fddf49]">Level {level}</span>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1.1fr] md:items-center">
            <div className="rounded-md border border-white/[.05] bg-[#0d1115] p-4 sm:p-5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">Arena rating</p>
              <div className="mt-1 flex items-end gap-2"><span className="font-mono text-xl font-semibold tracking-tight text-[#fddf49] sm:text-2xl">{rating.toLocaleString()}</span><span className="pb-1 text-xs font-semibold text-muted">RR</span></div>
              <div className="mt-4 flex items-center gap-2 border-t border-white/[.06] pt-3 text-[10px] text-on-surface-variant"><ShieldCheck size={13} className="text-[#fddf49]" />Rating recorded on your Arena profile</div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-on-surface">Level {level} progression</p><p className="mt-0.5 text-[10px] text-muted">{currentLevelXp} XP earned toward the next level</p></div><span className="shrink-0 font-mono text-xs font-semibold text-[#fddf49]">{Math.round(levelProgress)}%</span></div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#24292f]"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${levelProgress}%` }} /></div>
              <div className="mt-2 flex justify-between font-mono text-[9px] text-muted"><span>{currentLevelXp} XP</span><span>{500 - currentLevelXp} XP to Level {level + 1}</span></div>
              <p className="mt-5 rounded-md bg-[#16191c] p-3 text-[10px] leading-5 text-on-surface-variant">Complete coding challenges and ranked matches to earn XP and build your profile.</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col rounded-lg border border-white/[.06] bg-[#16191c] p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-on-surface sm:text-base">Player Snapshot</h2><p className="mt-1 text-[10px] text-muted">Profile facts and combat record</p></div><Trophy size={17} className="text-[#fddf49]" /></div>
          <div className="mt-4 grid flex-1 grid-cols-2 gap-2">
            <SnapshotTile label="Matches" value={totalMatches} />
            <SnapshotTile label="Win rate" value={`${winRate}%`} />
            <SnapshotTile label="Friends" value={friendsCount} />
            <SnapshotTile label="Badges" value={profileUser.badges?.length || 0} />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/[.06] pt-3 text-[10px] text-muted"><span>Member since</span><span className="font-mono text-on-surface-variant">{joined}</span></div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-white/[.06] bg-[#16191c] p-4 sm:p-5">
          <div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold text-on-surface sm:text-base">Recent Languages</h2><p className="mt-1 text-[10px] text-muted">Based on recent submissions</p></div><Code2 size={17} className="text-on-surface-variant" /></div>
          {languages.length ? <div className="mt-5 space-y-4">{languages.map((item) => <div key={item.key}><div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="font-semibold text-on-surface">{LANGUAGE_LABELS[item.key] || item.key}</span><span className="font-mono text-muted">{item.count} recent {item.count === 1 ? "submission" : "submissions"} <b className="ml-1 text-[#fddf49]">{item.percent}%</b></span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#24292f]"><div className="h-full rounded-full bg-primary" style={{ width: `${item.percent}%` }} /></div></div>)}</div> : <EmptyPanel icon={Code2} text={submissionsLoading ? "Loading recent language activity…" : isOwnProfile ? "Your language breakdown will appear after your next code submission." : "Public language activity is not available for this profile yet."} />}
          <div className="mt-5 flex items-center justify-between border-t border-white/[.06] pt-3 text-[9px] text-muted"><span>Supported Arena runtimes</span><span className="font-mono text-on-surface-variant">Python · JavaScript · C++ · Java</span></div>
        </section>

        <section className="rounded-lg border border-white/[.06] bg-[#16191c] p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-on-surface sm:text-base">Algorithmic Combat Attributes</h2><p className="mt-1 text-[10px] text-muted">Performance from recorded profile stats</p></div><Activity size={17} className="text-[#fddf49]" /></div>
          <div className="mt-5 space-y-4">
            <MetricBar label="Match win rate" value={`${winRate}%`} percent={winRate} />
            <MetricBar label="Problems solved" value={solved.toLocaleString()} percent={submissionCount ? Math.min(100, (solved / submissionCount) * 100) : 0} />
            <MetricBar label="Submissions recorded" value={submissionCount.toLocaleString()} percent={submissionCount ? 100 : 0} />
            <MetricBar label="Experience level" value={`Level ${level}`} percent={levelProgress} />
          </div>
          <p className="mt-5 flex items-center gap-2 rounded-md bg-[#16191c] p-3 text-[10px] leading-5 text-muted"><Zap size={14} className="shrink-0 text-[#fddf49]" />Stats reflect the data currently saved to this Arena profile.</p>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-white/[.06] bg-[#16191c] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-sm font-semibold text-on-surface sm:text-base">Recent Submissions <span className="h-2 w-2 rounded-full bg-primary" /></h2><p className="mt-1 text-[10px] text-muted">Latest code activity recorded on this profile</p></div>
          <span className="rounded-sm bg-[#16191c] px-2 py-1 font-mono text-[9px] text-muted">{submissionCount.toLocaleString()} total</span>
        </div>
        {recentSubmissions.length ? <div className="mt-4 space-y-2">{recentSubmissions.map((submission) => <SubmissionRow key={submission._id} submission={submission} />)}</div> : <EmptyPanel icon={Database} text={submissionsLoading ? "Loading recent submissions…" : isOwnProfile ? "No submissions yet. Your first solve will appear here." : "Submission history is only visible to the account owner."} />}
        {recentSubmissions.length > 0 && <p className="mt-4 text-right text-[9px] text-muted">Showing {recentSubmissions.length} latest submissions</p>}
      </section>

      <section className="mt-4 rounded-lg border border-white/[.06] bg-[#16191c] p-4 sm:p-5">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-on-surface sm:text-base">Arena Achievements</h2><p className="mt-1 text-[10px] text-muted">Badges earned on this profile</p></div><span className="font-mono text-[10px] text-muted">{profileUser.badges?.length || 0} unlocked</span></div>
        {profileUser.badges?.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{profileUser.badges.map((badge, index) => <article key={`${badge}-${index}`} className="flex items-center gap-3 rounded-md border border-white/[.05] bg-[#0d1115] p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#fddf49]/10 text-[#fddf49]"><Award size={17} /></span><div className="min-w-0"><h3 className="truncate text-xs font-semibold text-on-surface">{badge}</h3><p className="mt-0.5 text-[9px] text-muted">Arena achievement</p></div></article>)}</div> : <EmptyPanel icon={Award} text="No badges unlocked yet. Keep playing to earn your first Arena achievement." />}
      </section>
    </div>
  );
}

function TelemetryCard({ label, value, detail, icon: Icon, highlight = false }) {
  return <div className="flex min-h-[86px] items-center justify-between gap-2 rounded-md border border-white/[.04] bg-[#16191c] p-3 sm:p-3.5"><div className="min-w-0"><p className="text-[8px] font-semibold uppercase tracking-[.12em] text-muted sm:text-[9px]">{label}</p><p className={`mt-1 truncate font-mono text-sm font-semibold leading-none sm:text-base ${highlight ? "text-[#fddf49]" : "text-on-surface"}`}>{value}</p><p className="mt-1 truncate text-[8px] text-on-surface-variant sm:text-[9px]">{detail}</p></div><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[#16191c] ${highlight ? "text-[#fddf49]" : "text-on-surface-variant"}`}><Icon size={15} /></span></div>;
}

function SnapshotTile({ label, value }) {
  return <div className="rounded-md bg-[#0d1115] px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{label}</p><p className="mt-1 font-mono text-sm font-semibold text-[#fddf49]">{value}</p></div>;
}

function MetricBar({ label, value, percent }) {
  const width = Math.max(0, Math.min(100, Number(percent) || 0));
  return <div><div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="font-medium text-on-surface-variant">{label}</span><span className="font-mono font-semibold text-[#fddf49]">{value}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#24292f]"><div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} /></div></div>;
}

function EmptyPanel({ icon: Icon, text }) {
  return <div className="mt-4 flex min-h-24 items-center justify-center gap-3 rounded-md border border-dashed border-white/[.08] bg-[#0d1115]/70 px-4 py-5 text-center"><Icon size={17} className="shrink-0 text-muted" /><p className="max-w-lg text-[10px] leading-5 text-muted">{text}</p></div>;
}

function SubmissionRow({ submission }) {
  const accepted = submission.status === "accepted";
  const title = submission.problem?.title || "Code submission";
  const when = submission.createdAt ? new Date(submission.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Recent";
  const language = LANGUAGE_LABELS[submission.language] || submission.language;
  return <article className="flex flex-col gap-3 rounded-md border border-white/[.04] bg-[#16191c] p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-sm text-[8px] font-semibold uppercase ${accepted ? "bg-[#fddf49]/10 text-[#fddf49]" : "bg-[#db8080]/10 text-[#db8080]"}`}><span>{accepted ? "Passed" : "Review"}</span><span>{submission.passedCount ?? 0}/{submission.totalCount ?? 0}</span></span><div className="min-w-0"><h3 className="truncate text-xs font-semibold text-on-surface">{title}</h3><p className="mt-1 truncate font-mono text-[9px] text-on-surface-variant">{submission.problem?.slug || language} <span className="px-1 text-muted">·</span>{submission.executionTimeMs ?? 0}ms <span className="px-1 text-muted">·</span>{when}</p></div></div><span className={`inline-flex shrink-0 items-center gap-1.5 text-[9px] font-semibold ${accepted ? "text-[#fddf49]" : "text-[#db8080]"}`}>{accepted ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{accepted ? "Accepted" : submission.status?.replaceAll("_", " ")}</span></article>;
}
