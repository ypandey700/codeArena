import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, ArrowLeft, ArrowRight, ArrowUpRight, Award, Check, ChevronDown, ChevronRight, CircleAlert, Code2, Equal, Flame, LoaderCircle, MessageSquare, Radar, RotateCcw, ShieldCheck, Sparkles, Swords, Target, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import api from "../services/api";
import { getPlayerRank } from "../data/ranks";
import { ReportLegend, ScoreRadar, SubmissionTimeline } from "./MatchReportCharts";
import { CodeReview, InterviewReview, ReportEmpty, ReportHeading, ScoreBreakdown } from "./MatchReportDetails";
import { biggestDifference, formatNumber, isNumber, playerId, resultOutcome, signed } from "./matchReportUtils";
import "./MatchReport.css";

const TABS = [{ key: "overview", label: "Overview", icon: Radar }, { key: "scores", label: "Score breakdown", icon: Target }, { key: "interview", label: "AI interview", icon: MessageSquare }, { key: "code", label: "Code review", icon: Code2 }];

function PlayerAvatar({ player }) {
  const [failed, setFailed] = useState(null);
  return <span className="mr-avatar">{player.avatar && player.avatar !== failed ? <img src={player.avatar} alt="" onError={() => setFailed(player.avatar)} referrerPolicy="no-referrer" /> : (player.username || "?").slice(0, 2).toUpperCase()}</span>;
}

function ArenaSeal({ outcome }) {
  const Icon = outcome === "victory" ? Trophy : outcome === "draw" ? Equal : Swords;
  return <div className="mr-seal" aria-hidden="true"><svg viewBox="0 0 260 260"><circle className="mr-seal__orbit" cx="130" cy="130" r="115" /><circle cx="130" cy="130" r="95" /><path className="mr-seal__diamond" d="M130 28 232 130 130 232 28 130Z" /><path d="M130 49 211 130 130 211 49 130Z" /><path className="mr-seal__rays" d="M130 4v19m0 214v19M4 130h19m214 0h19M41 41l13 13m152 152 13 13M41 219l13-13M206 54l13-13" /><path className="mr-seal__laurel" d="M87 185c-37-18-47-64-25-96m6 60-20-8m18-8-20-13m22-4-16-19m17 65-15 1m119 22c37-18 47-64 25-96m-6 60 20-8m-18-8 20-13m-22-4 16-19m-17 65 15 1" /><circle className="mr-seal__core" cx="130" cy="130" r="52" /><circle className="mr-seal__spark" cx="47" cy="52" r="3" /><circle className="mr-seal__spark" cx="221" cy="181" r="3" /></svg><Icon size={49} strokeWidth={1.3} /><span>THE ARENA REMEMBERS</span></div>;
}

function PlayerResult({ player, own, winner, draw }) {
  return <article className={`mr-player-result${own ? " is-you" : ""}${winner ? " is-winner" : ""}`} aria-label={`${own ? "Your" : "Rival's"} result`}>
    <div className="mr-player-result__top"><div className="mr-player-result__identity"><PlayerAvatar player={player} /><div><span>{own ? "YOU" : "YOUR RIVAL"}{winner && <b><Trophy size={10} aria-hidden="true" />WINNER</b>}{draw && <b>DRAW</b>}</span><h2 title={player.username}>{player.username || (own ? "You" : "Rival")}</h2><p>{player.record?.tier || "Rank unavailable"}{isNumber(player.record?.rank) && <><i />#{formatNumber(player.record.rank, 0)}</>}</p></div></div><span className={`mr-rating-delta${player.ratingDelta < 0 ? " is-negative" : ""}`}>{signed(player.ratingDelta)}<small>RR</small></span></div>
    <div className="mr-player-result__bottom"><span className="mr-player-score">{formatNumber(player.scores?.total, 2)}<small>/100<span>FINAL SCORE</span></small></span><div><span>{formatNumber(player.ratingBefore, 0)}<ArrowRight size={12} aria-hidden="true" /><strong>{formatNumber(player.ratingAfter, 0)} <small>RR</small></strong></span><p>{signed(player.xpGained)} XP earned</p></div></div>
  </article>;
}

function RatingJourney({ me }) {
  const ladder = getPlayerRank({ rating: me.ratingAfter });
  const record = me.record;
  return <section className="mr-panel mr-climb"><ReportHeading eyebrow="ONE DUEL FURTHER" title="Your climb" icon={Trophy} /><div className="mr-climb__rating"><span>{ladder.current?.name || "Arena rating"}</span><strong>{formatNumber(me.ratingAfter, 0)}<small>RR</small></strong><span className={me.ratingDelta < 0 ? "is-negative" : ""}>{signed(me.ratingDelta)} this duel</span></div>{ladder.progress != null && <><div className="mr-climb__track" aria-label={`${formatNumber(ladder.progress, 0)} percent through ${ladder.current.name}`}><span style={{ width: `${ladder.progress}%` }} /></div><p className="mr-climb__next"><span>{ladder.current.name}</span><span>{formatNumber(Math.max(0, ladder.next.min - me.ratingAfter), 0)} RR to {ladder.next.name}<ChevronRight size={11} aria-hidden="true" /></span></p></>}{ladder.current && !ladder.next && <p className="mr-climb__top-tier">You’re competing in the highest arena tier.</p>}<div className="mr-climb__stats"><div><span><Flame size={13} aria-hidden="true" />Win streak</span><strong>{formatNumber(record?.streak, 0)}</strong></div><div><span><Award size={13} aria-hidden="true" />Peak rating</span><strong>{formatNumber(record?.peakRating, 0)}<small>RR</small></strong></div><div><span><Swords size={13} aria-hidden="true" />Win rate</span><strong>{formatNumber(record?.winRate)}<small>%</small></strong></div></div><p className="mr-panel-footnote">{record ? record.isCurrent ? "Showing your current player record." : "Player record saved after this duel." : "Player record unavailable for this match."}</p></section>;
}

function RivalryRecord({ history }) {
  const available = history && [history.total, history.wins, history.losses, history.draws].every(isNumber);
  const total = available ? history.total : 0;
  return <section className="mr-panel mr-rivalry"><ReportHeading eyebrow="GOOD RIVALS. BETTER STORIES." title="The rivalry" icon={Swords} />{available ? <><p className="mr-rivalry__meetings">{total === 1 ? "The first of many, perhaps." : `${formatNumber(total, 0)} duels. A story still being written.`}</p><div className="mr-rivalry__record"><div><strong>{history.wins}</strong><span>Your wins</span></div><span>:</span><div><strong>{history.losses}</strong><span>Rival wins</span></div><small>{history.draws} {history.draws === 1 ? "draw" : "draws"}</small></div><div className="mr-rivalry__track" aria-hidden="true"><span style={{ width: `${total ? history.wins / total * 100 : 0}%` }} /><span style={{ width: `${total ? history.draws / total * 100 : 0}%` }} /><span style={{ width: `${total ? history.losses / total * 100 : 0}%` }} /></div><div className="mr-recent-results"><span>Latest meetings<small>Newest first</small></span><div>{(Array.isArray(history.last) ? history.last : []).filter((value) => ["W", "L", "D"].includes(value)).map((value, index) => <span key={index} className={`mr-recent-result mr-recent-result--${value}`} title={value === "W" ? "You won" : value === "L" ? "Rival won" : "Draw"}>{value}</span>)}</div></div></> : <ReportEmpty icon={Swords} title="A new chapter awaits.">Head-to-head history is unavailable for this match.</ReportEmpty>}</section>;
}

function PlayerRecords({ me, rival }) {
  const rows = [
    ["Arena rating", (p) => formatNumber(p.record?.rating, 0)], ["Tier", (p) => p.record?.tier || "—"], ["Arena rank", (p) => isNumber(p.record?.rank) ? `#${formatNumber(p.record.rank, 0)}` : "—"],
    ["Wins · Losses · Draws", (p) => p.record && [p.record.wins, p.record.losses, p.record.draws].every(isNumber) ? `${p.record.wins} · ${p.record.losses} · ${p.record.draws}` : "—"],
    ["Win rate", (p) => isNumber(p.record?.winRate) ? `${formatNumber(p.record.winRate)}%` : "—"], ["Win streak", (p) => formatNumber(p.record?.streak, 0)], ["Peak rating", (p) => formatNumber(p.record?.peakRating, 0)], ["Duels played", (p) => formatNumber(p.record?.matches, 0)],
  ];
  return <details className="mr-panel mr-records"><summary><span className="mr-section-icon"><ShieldCheck size={19} aria-hidden="true" /></span><span><strong>Compare player records</strong><small>The bigger picture, beyond this duel.</small></span><ChevronDown size={18} aria-hidden="true" /></summary><div className="mr-records__body"><div className="mr-records__head"><span>Player record</span><strong>{me.username}<small>You</small></strong><strong>{rival.username}</strong></div>{rows.map(([label, render]) => <div className="mr-records__row" key={label}><span>{label}</span><strong>{render(me)}</strong><strong>{render(rival)}</strong></div>)}<p className="mr-panel-footnote">{[me, rival].map((player, index) => `${index ? "Rival" : "You"}: ${player.record ? player.record.isCurrent ? "current record" : "record includes this match" : "record unavailable"}`).join(" · ")}</p></div></details>;
}

export default function PostMortemReport({ onBack, onQueueNext }) {
  const { user } = useAuth();
  const { battleResult, setDuelState, joinQueue } = useBattle();
  const params = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState("overview");
  const tabsRef = useRef(null);
  const panelRef = useRef(null);
  const userId = String(user?._id || user?.id || "");
  const players = Array.isArray(data?.players) ? data.players : [];
  const me = players.find((player) => playerId(player) === userId);
  const rival = me && players.find((player) => playerId(player) !== userId);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    setLoading(true);
    setData(null);
    if (battleResult && (!params.id || String(params.id) === String(battleResult.battleId)) && ["finished", "abandoned"].includes(battleResult.status)) {
      setData(battleResult); setLoading(false); return;
    }
    let id = params.id;
    if (!id) { try { id = localStorage.getItem("lastBattleId"); } catch {} }
    if (!id) { setLoadError("There’s no saved match report to open yet. Play a duel to start your story."); setLoading(false); return; }
    api.get(`/battles/${encodeURIComponent(id)}`, { signal: controller.signal }).then((response) => {
      if (controller.signal.aborted) return;
      const result = response.data?.data;
      if (!result || String(result.battleId) !== String(id)) throw new Error("Report unavailable");
      if (!["finished", "abandoned"].includes(result.status)) { setLoadError("This duel is still in progress. Your final report will be available when the match is saved."); return; }
      setData(result);
    }).catch((error) => { if (!controller.signal.aborted) setLoadError(error.response?.status === 403 ? "This report is only available to the players in this duel." : "Your report couldn’t load. Give it another try."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [battleResult, params.id, revision]);

  useEffect(() => { setTab("overview"); }, [data?.battleId]);

  const back = () => { setDuelState?.("closed"); onBack?.(); navigate("/dashboard"); };
  const queue = () => { if (onQueueNext) onQueueNext(); else joinQueue?.("ranked_1v1"); };
  const selectTab = (key) => {
    setTab(key);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  };
  const openBreakdown = () => selectTab("scores");

  if (loading || loadError || !me || !rival) {
    const abandoned = data?.status === "abandoned";
    const error = loadError || (!loading && !abandoned ? "The player details for this report are unavailable." : "");
    return <section className="match-report mr-route-state"><div className="mr-route-state__icon">{loading ? <LoaderCircle size={32} className="mr-spin" aria-hidden="true" /> : abandoned ? <Swords size={34} aria-hidden="true" /> : <CircleAlert size={34} aria-hidden="true" />}</div><p className="mr-eyebrow">{loading ? "THE LAST WORD ON YOUR DUEL" : "A MOMENT BETWEEN MATCHES"}</p><h1>{loading ? "Putting your story together." : abandoned ? "This duel ended early." : "Your report is taking a moment."}</h1><p role={error ? "alert" : "status"}>{loading ? "Gathering the result, your code, and the details that mattered." : abandoned ? "The match was abandoned. No winner was declared." : error}</p>{!loading && <div>{!abandoned && <button type="button" className="mr-button mr-button--primary" onClick={() => setRevision((value) => value + 1)}><RotateCcw size={14} aria-hidden="true" />Try again</button>}<button type="button" className="mr-button" onClick={back}><ArrowLeft size={14} aria-hidden="true" />Command Deck</button></div>}</section>;
  }

  const outcome = resultOutcome(data, me);
  const difference = biggestDifference(me, rival);
  const token = String(data.battleId || "").slice(-8).toUpperCase();
  return <div className="match-report" data-outcome={outcome.key}>
    <div className="mr-wrap">
      <div className="mr-page-top"><button type="button" onClick={back}><ArrowLeft size={13} aria-hidden="true" />Command Deck<span>/</span><strong>Match report</strong></button><span className="mr-match-id"><ShieldCheck size={13} aria-hidden="true" />FINAL RESULT<i />#DUEL-{token}</span></div>
      <section className="mr-hero" aria-labelledby="mr-verdict">
        <div className="mr-hero__main"><div className="mr-hero__copy"><p className="mr-eyebrow"><span />RANKED 1V1<span className="mr-eyebrow__separator">/</span>{outcome.key === "victory" ? "DUEL WON" : outcome.key === "defeat" ? "DUEL LOST" : "DUEL COMPLETE"}</p><h1 id="mr-verdict">{outcome.label}</h1><p className="mr-hero__line">{outcome.line}</p><p className="mr-hero__description">{outcome.description}</p><div className="mr-challenge"><Code2 size={14} aria-hidden="true" /><strong>{data.problem?.title || "Ranked duel"}</strong>{data.problem?.difficulty && <span className={`mr-difficulty mr-difficulty--${data.problem.difficulty}`}>{data.problem.difficulty}</span>}</div></div><ArenaSeal outcome={outcome.key} /><div className="mr-hero__rewards"><div><span>RATING CHANGE</span><strong className={me.ratingDelta < 0 ? "is-negative" : ""}>{signed(me.ratingDelta)}<small>RR</small></strong></div><div><span>EXPERIENCE EARNED</span><strong>{signed(me.xpGained)}<small>XP</small></strong></div><div><span>TESTS PASSED</span><strong>{formatNumber(me.passedCount, 0)}<small>/{formatNumber(me.totalTests, 0)}</small></strong></div></div></div>
        <div className="mr-faceoff"><PlayerResult player={me} own winner={String(data.winner) === playerId(me)} draw={outcome.key === "draw"} /><div className="mr-faceoff__vs"><span>VS</span><Swords size={18} strokeWidth={1.3} aria-hidden="true" /></div><PlayerResult player={rival} winner={String(data.winner) === playerId(rival)} draw={outcome.key === "draw"} /></div>
      </section>

      <div ref={tabsRef} className="mr-tabs" role="tablist" aria-label="Match report sections" onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = TABS.findIndex((item) => item.key === tab);
        const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
        selectTab(TABS[next].key); tabsRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
      }}>{TABS.map(({ key, label, icon: Icon }) => <button type="button" role="tab" id={`mr-tab-${key}`} key={key} aria-selected={tab === key} aria-controls={`mr-panel-${key}`} tabIndex={tab === key ? 0 : -1} onClick={() => selectTab(key)}><Icon size={15} aria-hidden="true" /><span>{label}</span>{key === "interview" && Array.isArray(me.interview?.perQuestion) && me.interview.perQuestion.length > 0 && <small>{me.interview.perQuestion.length}</small>}</button>)}<span className="mr-tabs__closed"><Check size={12} aria-hidden="true" />Duel complete</span></div>

      <div ref={panelRef} className="mr-tab-panel" role="tabpanel" id={`mr-panel-${tab}`} aria-labelledby={`mr-tab-${tab}`} tabIndex={0}>
        {tab === "overview" ? <div className="mr-overview"><div className="mr-overview__top"><section className="mr-panel mr-performance"><ReportHeading eyebrow="TWO APPROACHES. ONE ARENA." title="Your performance fingerprint" icon={Radar} /><ReportLegend me={me} rival={rival} /><div className="mr-performance__body"><ScoreRadar me={me} rival={rival} /><div className="mr-performance__insight"><span className="mr-insight-icon"><Sparkles size={19} aria-hidden="true" /></span><p className="mr-eyebrow">THE SCORING EDGE</p>{difference ? <><h3>{difference.label}<span>{signed(difference.difference, 2)} <small>pts</small></span></h3><p>{difference.difference > 0 ? "You earned" : `${rival.username || "Your rival"} earned`} {formatNumber(Math.abs(difference.difference), 2)} more contributed points here. The largest component difference in this duel.</p></> : <><h3>Every detail counts.</h3><p>Explore each available component and how it contributed to the final score.</p></>}<button type="button" className="mr-text-button" onClick={openBreakdown}>Explore the breakdown<ArrowRight size={13} aria-hidden="true" /></button></div></div></section><RatingJourney me={me} /></div><div className="mr-overview__bottom"><RivalryRecord history={data.headToHead} /><section className="mr-panel mr-submissions"><ReportHeading eyebrow="THE MOVES THAT GOT YOU HERE" title="Your submission story" icon={Activity} /><ReportLegend me={me} rival={rival} /><SubmissionTimeline data={data} me={me} rival={rival} /></section></div><PlayerRecords me={me} rival={rival} /></div> : tab === "scores" ? <ScoreBreakdown data={data} me={me} rival={rival} /> : tab === "interview" ? <InterviewReview me={me} rival={rival} /> : <CodeReview data={data} me={me} rival={rival} />}
      </div>
      <p className="mr-endnote"><Swords size={13} aria-hidden="true" />Every duel leaves you with something. Take it into the next one.</p>
    </div>
    <footer className="mr-actions"><div><span className="mr-actions__mark"><Swords size={20} aria-hidden="true" /></span><div><strong>The next chapter is yours.</strong><span>Another rival. Another chance to climb.</span></div></div><div><button type="button" className="mr-button" onClick={back}><ArrowLeft size={14} aria-hidden="true" /><span>Command Deck</span></button><button type="button" className="mr-button mr-button--primary" onClick={queue}><Swords size={15} aria-hidden="true" />Find my next duel<ArrowUpRight size={16} aria-hidden="true" /></button></div></footer>
  </div>;
}
