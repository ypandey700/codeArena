import { useState } from "react";
import { Activity, Radar } from "lucide-react";
import { boundedScore, formatNumber, isNumber, METRICS, playerId } from "./matchReportUtils";

export function ReportLegend({ me, rival }) {
  return <div className="mr-legend"><span><i />{me.username || "You"}<small>You</small></span><span><i />{rival.username || "Rival"}</span></div>;
}

export function ScoreRadar({ me, rival }) {
  const [selected, setSelected] = useState(null);
  const axes = METRICS.filter(({ key }) => isNumber(me.scores?.[key]) && isNumber(rival.scores?.[key]));
  const active = axes.find(({ key }) => key === selected);
  if (axes.length < 3) return <div className="mr-chart-empty"><Radar size={36} strokeWidth={1.2} aria-hidden="true" /><strong>{axes.length ? "A smaller scoring picture." : "No shared scores available."}</strong><p>{axes.length ? "Open the score breakdown to compare the available components." : "This duel has no comparable performance scores."}</p></div>;
  const point = (index, value, radius = 106) => {
    const angle = index / axes.length * Math.PI * 2 - Math.PI / 2;
    return [210 + Math.cos(angle) * radius * value / 100, 162 + Math.sin(angle) * radius * value / 100];
  };
  return <div className="mr-radar">
    <svg viewBox="0 0 420 325" role="img" aria-label="Performance comparison across shared scoring components">
      {[25, 50, 75, 100].map((value) => <polygon key={value} points={axes.map((_, index) => point(index, value).join(",")).join(" ")} className="mr-radar__grid" />)}
      {axes.map(({ key, label }, index) => {
        const end = point(index, 100);
        const position = point(index, 100, 139);
        return <g key={key}><line x1="210" y1="162" x2={end[0]} y2={end[1]} className="mr-radar__axis" /><text x={position[0]} y={position[1]} textAnchor="middle" dominantBaseline="middle" className={selected === key ? "is-selected" : ""}>{label}</text></g>;
      })}
      {[rival, me].map((player, side) => <g key={side} className={side ? "mr-chart-you" : "mr-chart-rival"}><polygon className="mr-radar__series" points={axes.map(({ key }, index) => point(index, boundedScore(player.scores[key])).join(",")).join(" ")} />{axes.map(({ key, label }, index) => {
        const [cx, cy] = point(index, boundedScore(player.scores[key]));
        return <circle key={key} cx={cx} cy={cy} r={selected === key ? 5 : 3} tabIndex={0} role="img" aria-label={`${player.username || (side ? "You" : "Rival")}, ${label}, ${formatNumber(player.scores[key])} out of 100`} onMouseEnter={() => setSelected(key)} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected(key)} onBlur={() => setSelected(null)}><title>{label}: {formatNumber(player.scores[key])}/100</title></circle>;
      })}</g>)}
    </svg>
    <div className="mr-radar__readout" aria-live="polite">{active ? <><strong>{active.label}</strong><span>You <b>{formatNumber(me.scores[active.key])}</b></span><span>Rival <b>{formatNumber(rival.scores[active.key])}</b></span></> : <><span className="mr-radar__hint">Hover or focus a point to compare.</span><small>{axes.length} shared components · out of 100</small></>}</div>
  </div>;
}

export function SubmissionTimeline({ data, me, rival }) {
  const [selected, setSelected] = useState(null);
  const ids = [playerId(me), playerId(rival)];
  const events = (Array.isArray(data.timeline) ? data.timeline : []).filter((event) => ids.includes(String(event.user)) && isNumber(event.at) && isNumber(event.passedCount)).slice().sort((a, b) => a.at - b.at);
  if (!events.length) return <div className="mr-chart-empty mr-chart-empty--timeline"><Activity size={29} strokeWidth={1.3} aria-hidden="true" /><strong>No submissions on the timeline.</strong><p>This match has no recorded submission events.</p></div>;
  const first = events[0].at;
  const last = events.at(-1).at;
  const elapsed = last - first;
  const maximum = Math.max(...events.map((event) => event.passedCount), me.totalTests || 0, rival.totalTests || 0, 1);
  const x = (at) => elapsed ? 48 + (at - first) / elapsed * 660 : 378;
  const y = (passed) => 188 - passed / maximum * 148;
  return <div className="mr-timeline">
    <svg viewBox="0 0 750 225" role="img" aria-label="Tests passed over time since the first recorded submission">
      {[0, .5, 1].map((fraction) => <g key={fraction}><line x1="48" x2="708" y1={y(fraction * maximum)} y2={y(fraction * maximum)} className="mr-timeline__grid" /><text x="33" y={y(fraction * maximum) + 4} textAnchor="end">{formatNumber(fraction * maximum, 1)}</text></g>)}
      {[me, rival].map((player, side) => {
        const own = events.filter((event) => String(event.user) === playerId(player));
        return <g key={side} className={side ? "mr-chart-rival" : "mr-chart-you"}>{own.length > 1 && <polyline points={own.map((event) => `${x(event.at)},${y(event.passedCount)}`).join(" ")} className="mr-timeline__line" />}{own.map((event, index) => <circle key={index} cx={x(event.at)} cy={y(event.passedCount)} r={selected?.event === event ? 6 : 4} tabIndex={0} role="img" aria-label={`${player.username || (side ? "Rival" : "You")}: ${event.passedCount} tests passed, ${formatNumber((event.at - first) / 1000)} seconds after first submission`} onMouseEnter={() => setSelected({ event, player })} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected({ event, player })} onBlur={() => setSelected(null)}><title>{player.username}: {event.passedCount} tests passed</title></circle>)}</g>;
      })}
      <text x="48" y="213">0s</text><text x="708" y="213" textAnchor="end">{formatNumber(elapsed / 1000)}s</text>
    </svg>
    <p className="mr-timeline__readout" aria-live="polite">{selected ? <><strong>{selected.player.username}</strong><span>{selected.event.passedCount} tests passed</span><span>+{formatNumber((selected.event.at - first) / 1000)}s</span></> : <><span>{events.length} recorded {events.length === 1 ? "submission" : "submissions"}</span><span>Time since the first recorded submission</span></>}</p>
  </div>;
}
