import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bug, Check, ChevronRight,
  CircleAlert, Code2, Database, Flame, GitBranch, Layers, LoaderCircle,
  RotateCcw, ShieldCheck, Sparkles, Swords, Target, Trophy, Users, Zap,
} from "lucide-react";
import Brand from "../components/Brand";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import api from "../services/api";
import "./CommandDeck.css";

const number = (value) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";

function DuelEmblem() {
  return (
    <svg className="cd-duel-emblem" viewBox="0 0 260 260" fill="none" aria-hidden="true" focusable="false">
      <circle cx="130" cy="130" r="122" stroke="#ffffff08" />
      <circle cx="130" cy="130" r="105" stroke="#ffffff0d" />
      <g className="cd-duel-emblem__orbit">
        <circle cx="130" cy="130" r="116" stroke="#fddf4940" strokeDasharray="2 11" />
        <circle cx="130" cy="14" r="3.5" fill="#fddf49" />
        <circle cx="130" cy="246" r="3.5" fill="#9db5c9" />
      </g>
      <path d="M130 26v14m0 180v14M26 130h14m180 0h14" stroke="#ffffff32" />
      <path d="m130 44 75 43v86l-75 43-75-43V87Z" fill="#fddf4906" stroke="#fddf4938" />
      <path d="m130 56 64 37v74l-64 37-64-37V93Z" fill="#161c1c" stroke="#ffffff12" />
      <path d="m84 74 18 5 64 64-12 12-64-64Z" fill="#9db5c9" />
      <path d="m176 74-18 5-64 64 12 12 64-64Z" fill="#fddf49" />
      <path d="m84 74 18 5 64 64m10-69-18 5-64 64" stroke="#ffffff50" strokeWidth="1.5" />
      <path d="m141 166 25-25m-72 0 25 25" stroke="#d3b63c" strokeWidth="6" strokeLinecap="round" />
      <path d="m156 156 15 15m-67-15-15 15" stroke="#afc1ce" strokeWidth="7" strokeLinecap="round" />
      <circle cx="130" cy="130" r="5" fill="#f5f5f7" />
      <path d="m39 50 5-5m172 170-5 5M39 210l5 5M211 45l5 5" stroke="#fddf4955" strokeWidth="2" />
    </svg>
  );
}

function RivalCards() {
  return (
    <div className="cd-rival-art" aria-hidden="true">
      <span className="cd-rival-art__orbit" />
      <div className="cd-rival-art__card cd-rival-art__card--you"><Code2 size={31} strokeWidth={1.4} /><span>YOU</span></div>
      <span className="cd-rival-art__vs"><Swords size={17} /></span>
      <div className="cd-rival-art__card cd-rival-art__card--rival"><span className="cd-rival-art__braces">{ "{ }" }</span><span>NEXT RIVAL</span></div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, accent }) {
  return (
    <article className={`cd-metric${accent ? " cd-metric--accent" : ""}`}>
      <div className="cd-metric__heading"><span>{label}</span><Icon size={16} aria-hidden="true" /></div>
      <strong className="cd-metric__value">{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function MatchRow({ battle, userId }) {
  const me = battle.players?.find((player) => String(player.userId) === String(userId));
  const opponent = battle.players?.find((player) => String(player.userId) !== String(userId));
  const result = !battle.winner ? "draw" : String(battle.winner) === String(userId) ? "win" : "loss";
  const labels = { win: "Victory", loss: "Defeat", draw: "Draw" };
  const Icon = result === "win" ? ArrowUpRight : result === "loss" ? ArrowDownRight : GitBranch;
  const delta = me?.ratingDelta;
  return (
    <Link to={`/match-report/${encodeURIComponent(battle.battleId)}`} className="cd-match">
      <span className={`cd-match__result cd-match__result--${result}`}><Icon size={19} aria-hidden="true" /><span>{labels[result]}</span></span>
      <span className="cd-match__problem"><strong>{battle.problem?.title || "Ranked duel"}</strong><span>{opponent?.username ? `vs. ${opponent.username}` : "1v1 ranked"}{battle.problem?.difficulty ? ` · ${battle.problem.difficulty}` : ""}</span></span>
      <span className="cd-match__delta">{typeof delta === "number" ? `${delta > 0 ? "+" : ""}${delta} RR` : "View report"}</span>
      <ChevronRight size={16} className="cd-match__arrow" aria-hidden="true" />
    </Link>
  );
}

const upcoming = [
  { icon: Bug, name: "Debug Blitz", copy: "Find the bug. Beat the clock.", color: "cyan" },
  { icon: Database, name: "SQL Clash", copy: "A different kind of query battle.", color: "violet" },
  { icon: GitBranch, name: "Private rooms", copy: "Your friends. Your own arena.", color: "gold" },
  { icon: Users, name: "Squads", copy: "Keep your favourite rivals close.", color: "coral" },
];

export default function CommandDeck({ onQuickDuel }) {
  const { user } = useAuth();
  const { duelState } = useBattle();
  const [arena, setArena] = useState({ status: "loading", count: null });
  const [history, setHistory] = useState({ status: "loading", battles: [] });
  const [historyRevision, setHistoryRevision] = useState(0);
  const searching = ["queue", "minimized"].includes(duelState);
  const startDuel = useCallback(() => {
    if (duelState === "closed") onQuickDuel?.();
  }, [duelState, onQuickDuel]);

  useEffect(() => {
    if (!user?._id) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await api.get("/arena/stats", { signal: controller.signal });
        const count = response.data?.data?.inQueue;
        if (!controller.signal.aborted) setArena({ status: typeof count === "number" ? "ready" : "error", count: typeof count === "number" ? count : null });
      } catch {
        if (!controller.signal.aborted) setArena({ status: "error", count: null });
      }
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) return;
    const controller = new AbortController();
    setHistory({ status: "loading", battles: [] });
    api.get("/battles/me", { params: { limit: 10 }, signal: controller.signal }).then((response) => {
      const battles = response.data?.data?.battles;
      if (!Array.isArray(battles)) throw new Error("Missing match history");
      if (!controller.signal.aborted) setHistory({ status: "ready", battles: battles.filter((battle) => battle.status === "finished" && battle.battleId).slice(0, 3) });
    }).catch(() => {
      if (!controller.signal.aborted) setHistory({ status: "error", battles: [] });
    });
    return () => controller.abort();
  }, [user?._id, historyRevision]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === "Space" && event.target === document.body && !event.repeat && !event.defaultPrevented && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        startDuel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [startDuel]);

  const stats = user?.stats || {};
  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const draws = stats.draws ?? 0;
  const matches = wins + losses + draws;
  const winRate = matches ? Math.round(wins / matches * 100) : 0;
  const profilePath = `/u/${encodeURIComponent(user?.username || "")}`;

  return (
    <div className="command-deck">
      <div className="cd-wrap">
        <header className="cd-intro">
          <div>
            <p className="cd-eyebrow"><span className="cd-diamond" />Command deck <span className="cd-eyebrow__separator">/</span><span>Your arena awaits</span></p>
            <h1>Welcome back, <span>{user?.username || "challenger"}.</span></h1>
            <p className="cd-intro__copy">A fresh challenge. A worthy rival. Your next breakthrough.</p>
          </div>
          <Link to={profilePath} className="cd-player-link" aria-label="View your player profile">
            <span className="cd-player-link__avatar" aria-hidden="true">{user?.avatar ? <img src={user.avatar} alt="" /> : <ShieldCheck size={24} aria-hidden="true" />}</span>
            <span><small>Your player card</small><strong>{user?.tier || "Arena player"}{user?.rank != null ? ` #${user.rank}` : ""}</strong></span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </header>

        <section className="cd-metrics" aria-label="Your arena statistics">
          <Metric icon={Trophy} label="Arena rating" value={<>{number(user?.rating)}<small>RR</small></>} detail={user?.tier ? `${user.tier} · Ranked 1v1` : "Your competitive rating"} accent />
          <Metric icon={Target} label="Win rate" value={<>{winRate}<small>%</small></>} detail={`${number(wins)} wins · ${number(losses)} losses · ${number(draws)} draws`} />
          <Metric icon={Flame} label="Current streak" value={<>{number(stats.streak ?? 0)}<small>wins</small></>} detail={stats.streak ? "Keep the momentum going." : "Every streak starts with one."} />
          <Metric icon={Code2} label="Problems solved" value={number(stats.problemsSolved ?? 0)} detail={`${number(stats.submissions ?? 0)} total submissions`} />
        </section>

        <div className="cd-main-event">
          <section className="cd-duel" aria-labelledby="cd-duel-title">
            <div className="cd-duel__top">
              <p className="cd-eyebrow"><Swords size={16} aria-hidden="true" />The main event <span className="cd-mode-tag">Ranked 1v1</span></p>
              <span className="cd-queue" aria-live="polite"><Users size={13} aria-hidden="true" />{arena.status === "loading" ? "Checking the arena…" : arena.status === "ready" ? <><strong>{number(arena.count)}</strong> in queue</> : "Queue count unavailable"}</span>
            </div>
            <div className="cd-duel__body">
              <div><h2 id="cd-duel-title">Two minds.<br />One <em>problem.</em></h2><p>The same challenge. Two different approaches.<br className="cd-desktop-break" /> Code it, explain it, and let your skills do the talking.</p></div>
              <DuelEmblem />
            </div>
            <ol className="cd-duel__steps" aria-label="How a ranked duel works">
              <li><span>01 / SOLVE</span><strong>Make your move.</strong><p>Code your solution.</p></li>
              <li><span>02 / EXPLAIN</span><strong>Own your thinking.</strong><p>Talk through it with AI.</p></li>
              <li><span>03 / RESULTS</span><strong>See where you stand.</strong><p>Get your match breakdown.</p></li>
            </ol>
            <div className="cd-duel__bottom">
              <div className="cd-duel__languages"><span>YOUR TOOLKIT</span><div>{["Python", "JavaScript", "C++", "Java"].map((language) => <span key={language}>{language}</span>)}</div></div>
              <button type="button" className="cd-button cd-button--primary" onClick={startDuel} disabled={searching} aria-keyshortcuts="Space">{searching ? <LoaderCircle size={17} className="cd-spin" /> : <Swords size={17} aria-hidden="true" />}<span>{searching ? "Finding your rival…" : "Find my opponent"}</span>{!searching && <><ArrowRight size={17} aria-hidden="true" /><kbd>Space</kbd></>}</button>
            </div>
          </section>

          <section className="cd-edge" aria-labelledby="cd-edge-title">
            <p className="cd-eyebrow"><span className="cd-diamond" />Choose your challenge</p>
            <h2 id="cd-edge-title">Find your<br />next <em>edge.</em></h2>
            <p>Step out of your comfort zone.<br />That's where the good stuff happens.</p>
            <RivalCards />
            <Link to="/battle-modes" className="cd-edge__action"><span>Explore battle modes</span><ArrowUpRight size={19} aria-hidden="true" /></Link>
            <div className="cd-edge__note"><Sparkles size={13} aria-hidden="true" /><span>One arena. Room to grow.</span></div>
          </section>
        </div>

        <div className="cd-lower-grid">
          <section className="cd-replays" aria-labelledby="cd-replay-title">
            <div className="cd-section-heading"><div><p className="cd-eyebrow">Look back. Level up.</p><h2 id="cd-replay-title">The replay room<span>.</span></h2></div><span className="cd-section-icon"><RotateCcw size={20} aria-hidden="true" /></span></div>
            {history.status === "loading" ? (
              <div className="cd-history-state" role="status"><LoaderCircle className="cd-spin" size={24} aria-hidden="true" /><p>Gathering your last battles…</p></div>
            ) : history.status === "error" ? (
              <div className="cd-history-state" role="status"><CircleAlert size={27} aria-hidden="true" /><h3>Your matches couldn't load.</h3><p>Your record is still yours. Give it another try.</p><button type="button" className="cd-text-button" onClick={() => setHistoryRevision((value) => value + 1)}>Try again <RotateCcw size={13} aria-hidden="true" /></button></div>
            ) : history.battles.length ? (
              <><div className="cd-match-list">{history.battles.map((battle) => <MatchRow key={battle.battleId} battle={battle} userId={user?._id} />)}</div><p className="cd-replays__note">The latest finished duels from your recent matches. Open one to see what clicked.</p></>
            ) : (
              <div className="cd-history-state cd-history-state--empty"><div className="cd-empty-replay" aria-hidden="true"><Layers size={30} strokeWidth={1.2} /><span><Check size={10} /></span></div><h3>Your first story is unwritten.</h3><p>Finish a ranked duel. Your result, code review, and next<br className="cd-desktop-break" /> breakthrough will be waiting right here.</p><button type="button" className="cd-text-button" onClick={startDuel} disabled={searching}>Make your first move <ArrowRight size={14} aria-hidden="true" /></button></div>
            )}
          </section>

          <section className="cd-progress" aria-labelledby="cd-progress-title">
            <div className="cd-section-heading"><div><p className="cd-eyebrow">Your journey</p><h2 id="cd-progress-title">Every line counts<span>.</span></h2></div><Zap size={18} className="cd-progress__zap" aria-hidden="true" /></div>
            <dl><div><dt><Sparkles size={14} aria-hidden="true" />Experience earned</dt><dd>{number(user?.xp ?? 0)} <small>XP</small></dd></div><div><dt><Trophy size={14} aria-hidden="true" />Personal best</dt><dd>{number(stats.peakRating ?? user?.rating)} <small>RR</small></dd></div><div><dt><Code2 size={14} aria-hidden="true" />Submissions</dt><dd>{number(stats.submissions ?? 0)}</dd></div><div><dt><Swords size={14} aria-hidden="true" />Battles played</dt><dd>{number(matches)}</dd></div></dl>
            <Link to={profilePath} className="cd-progress__profile">The full player story <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </section>
        </div>

        <section className="cd-horizon" aria-labelledby="cd-horizon-title">
          <div className="cd-horizon__heading"><div><p className="cd-eyebrow">The arena keeps growing</p><h2 id="cd-horizon-title">On the horizon<span>.</span></h2></div><span className="cd-horizon__caption">More ways to challenge yourself.</span></div>
          <div className="cd-horizon__grid">{upcoming.map(({ icon: Icon, name, copy, color }) => <article className={`cd-coming cd-coming--${color}`} key={name}><div className="cd-coming__top"><span className="cd-coming__icon"><Icon size={20} strokeWidth={1.5} aria-hidden="true" /></span><span className="cd-soon">Coming soon</span></div><h3>{name}</h3><p>{copy}</p></article>)}</div>
        </section>

        <footer className="cd-footer"><Brand compact /><p>A little better. Every battle.</p><span><kbd>Space</kbd> to find your next rival</span></footer>
      </div>
    </div>
  );
}
