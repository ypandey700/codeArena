import { useEffect, useRef, useState } from "react";
import { Award, Check, CheckCircle2, ChevronDown, CircleAlert, Code2, Copy, Download, FileCode2, Lightbulb, MessageSquare, Minus, Target, WrapText, X } from "lucide-react";
import { boundedScore, formatNumber, isNumber, LANGUAGES, METRICS, metricDetail, readOwnCode } from "./matchReportUtils";

export function ReportHeading({ eyebrow, title, icon: Icon, children }) {
  return <div className="mr-section-heading"><div>{eyebrow && <p className="mr-eyebrow">{eyebrow}</p>}<h2>{title}<span>.</span></h2></div>{children || (Icon && <span className="mr-section-icon"><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></span>)}</div>;
}

export function ReportEmpty({ icon: Icon = CircleAlert, title, children }) {
  return <div className="mr-empty"><Icon size={30} strokeWidth={1.3} aria-hidden="true" /><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function ScoreBreakdown({ data, me, rival }) {
  return <section className="mr-panel mr-score-panel">
    <ReportHeading eyebrow="EVERY POINT HAS A STORY" title="The score, unpacked" icon={Target} />
    <p className="mr-section-copy">See how each part of your duel contributed to the final result.</p>
    <div className="mr-score-table-heading"><span>Scoring component</span><span><i className="mr-you-dot" />{me.username || "You"}<small>You</small></span><span><i className="mr-rival-dot" />{rival.username || "Rival"}</span><span>Weight</span></div>
    <div className="mr-score-rows">{METRICS.map((metric, index) => {
      const weight = data.scoring?.activeWeights?.[metric.key];
      const nominal = data.scoring?.weights?.[metric.key];
      const shared = isNumber(me.scores?.[metric.key]) && isNumber(rival.scores?.[metric.key]);
      return <article className={`mr-score-row${shared ? "" : " is-unavailable"}`} key={metric.key}>
        <div className="mr-score-row__name"><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{metric.label}</h3><p>{metric.detail}</p></div></div>
        {[me, rival].map((player, side) => {
          const score = player.scores?.[metric.key];
          const points = player.points?.[metric.key];
          return <div className={`mr-score-cell${side ? " mr-score-cell--rival" : ""}`} key={side}>
            <span className="mr-score-cell__mobile-label">{side ? rival.username || "Rival" : "You"}</span>
            <div className="mr-score-cell__numbers"><strong>{formatNumber(score)}<small>{isNumber(score) ? "/100" : "Not scored"}</small></strong>{isNumber(points) && <span>{formatNumber(points, 2)} <small>pts</small></span>}</div>
            <div className="mr-score-track" aria-hidden="true"><span style={{ width: `${boundedScore(score)}%` }} /></div>
            <p>{metricDetail(metric.key, player, data.problem)}</p>
          </div>;
        })}
        <div className="mr-score-weight">{isNumber(weight) ? <><strong>{formatNumber(weight)}<small>%</small></strong>{isNumber(nominal) && Math.abs(weight - nominal) > .01 && <span>{formatNumber(nominal)}% base</span>}</> : <><Minus size={15} aria-hidden="true" /><span>Excluded</span></>}</div>
      </article>;
    })}</div>
    <div className="mr-score-total"><div><strong>The final score</strong><p>Unavailable components are excluded for both players.</p></div><span><i className="mr-you-dot" />{formatNumber(me.scores?.total, 2)}<small>You</small></span><b>:</b><span><i className="mr-rival-dot" />{formatNumber(rival.scores?.total, 2)}<small>Rival</small></span></div>
    <p className="mr-panel-footnote">Scores, contribution points, and active weights are taken from this match’s final result. Active weights add up to 100%.</p>
  </section>;
}

function FeedbackCard({ title, items, tone, icon: Icon }) {
  const entries = Array.isArray(items) ? items.filter((item) => typeof item === "string") : [];
  return <section className={`mr-feedback mr-feedback--${tone}`}><h3><Icon size={17} aria-hidden="true" />{title}</h3>{entries.length ? <ul>{entries.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>No feedback was recorded for this match.</p>}</section>;
}

export function InterviewReview({ me, rival }) {
  const questions = Array.isArray(me.interview?.perQuestion) ? me.interview.perQuestion : [];
  return <div className="mr-interview-review">
    <section className="mr-panel">
      <ReportHeading eyebrow="THE THINKING BEHIND THE CODE" title="More than a correct answer" icon={MessageSquare} />
      <div className="mr-interview-summaries">{[me, rival].map((player, side) => <article className={`mr-interview-summary${side ? " mr-interview-summary--rival" : ""}`} key={side}><div><span>{side ? "YOUR RIVAL" : "YOUR INTERVIEW"}</span><h3>{player.username || (side ? "Rival" : "You")}</h3></div><strong>{formatNumber(player.scores?.interview)}<small>{isNumber(player.scores?.interview) ? "/100" : "Not scored"}</small></strong><dl><div><dt>Understanding</dt><dd>{formatNumber(player.interview?.understanding)}<small>/10</small></dd></div><div><dt>Questions answered</dt><dd>{formatNumber(player.interview?.answered, 0)}<small>/{formatNumber(player.interview?.total, 0)}</small></dd></div></dl></article>)}</div>
    </section>
    <section className="mr-panel">
      <ReportHeading eyebrow="IN YOUR OWN WORDS" title="Your interview, revisited" icon={FileCode2} />
      <p className="mr-section-copy">Your questions, your answers, and the feedback to take into your next duel.</p>
      {questions.length ? <div className="mr-questions">{questions.map((entry, index) => {
        const status = entry.status === "skipped" ? "Skipped" : entry.status === "expired" ? "Time expired" : entry.status === "answered" ? "Answered" : "Recorded";
        return <details className="mr-question" key={index} open={index === 0}><summary><span className="mr-question__number">{String(index + 1).padStart(2, "0")}</span><span className="mr-question__heading"><strong>{entry.question || "Interview question"}</strong><small className={entry.status === "answered" ? "is-answered" : ""}>{status}</small></span><ChevronDown size={16} aria-hidden="true" /></summary><div className="mr-question__body"><span className="mr-field-label">Your answer</span><p>{entry.status === "skipped" ? "You skipped this question." : entry.answer || "No answer was recorded."}</p><dl>{["accuracy", "depth", "clarity"].map((key) => <div key={key}><dt>{key}</dt><dd>{formatNumber(entry[key])}<small>/10</small></dd></div>)}</dl></div></details>;
      })}</div> : <ReportEmpty icon={MessageSquare} title="No transcript for this duel.">Your recorded interview questions and answers will appear here when available.</ReportEmpty>}
      <div className="mr-feedback-grid"><FeedbackCard title="What worked well" items={me.interview?.feedback?.strengths} tone="strength" icon={Award} /><FeedbackCard title="For your next interview" items={me.interview?.feedback?.tips} tone="tip" icon={Lightbulb} /></div>
    </section>
  </div>;
}

function HighlightLine({ line }) {
  const tokens = line.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*$|#.*$|\b(?:import|from|def|class|return|if|else|elif|for|while|in|and|or|not|True|False|None|const|let|var|function|async|await|new|public|static|void|int|double|boolean|String|using|namespace|include|try|catch|throw|break|continue)\b|\b\d+(?:\.\d+)?\b)/g);
  return tokens.map((token, index) => {
    const type = /^(\/\/|#)/.test(token) ? "comment" : /^["'`]/.test(token) ? "string" : /^\d+(?:\.\d+)?$/.test(token) ? "number" : index % 2 ? "keyword" : "plain";
    return type === "plain" ? token : <span key={index} className={`mr-syntax-${type}`}>{token}</span>;
  });
}

export function CodeReview({ data, me, rival }) {
  const { code, language } = readOwnCode(data, me);
  const languageInfo = LANGUAGES[language] || { label: language || "Language unavailable", file: "solution.txt" };
  const [wrap, setWrap] = useState(false);
  const [copyState, setCopyState] = useState("idle");
  const [filter, setFilter] = useState("all");
  const [downloadError, setDownloadError] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const tests = (Array.isArray(me.myTests) ? me.myTests : []).map((test, index) => ({ test, index }));
  const visibleTests = tests.filter(({ test }) => filter === "all" || (filter === "passed" ? test.passed === true : test.passed === false));
  const failures = tests.filter(({ test }) => test.passed === false).length;
  const lines = typeof code === "string" ? code.split("\n") : [];
  const copyCode = async () => {
    clearTimeout(copyTimer.current);
    try { await navigator.clipboard.writeText(code); setCopyState("copied"); }
    catch { setCopyState("failed"); }
    copyTimer.current = setTimeout(() => setCopyState("idle"), 2500);
  };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = languageInfo.file;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadError(false);
    } catch { setDownloadError(true); }
  };
  return <div className="mr-code-review">
    <section className="mr-panel mr-code-panel">
      <ReportHeading eyebrow="THE SOLUTION YOU SHIPPED" title="Your final code" icon={Code2} />
      {me.resultSource === "auto_draft" && <p className="mr-note"><CircleAlert size={15} aria-hidden="true" />Your last editor draft was evaluated automatically when coding ended.</p>}
      <div className="mr-code-toolbar"><span><FileCode2 size={15} aria-hidden="true" /><strong>{languageInfo.file}</strong><small>{languageInfo.label}</small></span><div><button type="button" onClick={() => setWrap((value) => !value)} aria-pressed={wrap} title="Toggle line wrapping"><WrapText size={15} aria-hidden="true" /><span>Wrap</span></button><button type="button" disabled={!code} onClick={copyCode}><span>{copyState === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}</span>{copyState === "copied" ? "Copied" : "Copy"}</button><button type="button" disabled={!code} onClick={download} aria-label="Download your code" title="Download your code"><Download size={15} aria-hidden="true" /></button></div></div>
      {typeof code === "string" && code ? <div className={`mr-code-view${wrap ? " is-wrapped" : ""}`} tabIndex={0} aria-label="Your final submitted code, read only">{lines.map((line, index) => <div className="mr-code-line" key={index}><span className="mr-code-number" aria-hidden="true">{index + 1}</span><code><HighlightLine line={line} />{!line && "\n"}</code></div>)}</div> : <ReportEmpty icon={Code2} title={code === "" ? "No code was submitted." : "Your final code is unavailable."}>Code is shown only for your own solution.</ReportEmpty>}
      <div className="mr-code-status"><span><span />Final submission · read only</span><span>{lines.length ? `${lines.length} lines` : ""}</span></div>
      {copyState === "failed" && <p className="mr-copy-error" role="status">Clipboard access is unavailable. You can select and copy your code above.</p>}
      {downloadError && <p className="mr-copy-error" role="status">The download could not start. You can copy your code instead.</p>}
    </section>

    <section className="mr-panel">
      <ReportHeading eyebrow="A CLOSER LOOK" title="Test case review" icon={CheckCircle2} />
      <div className="mr-test-filters" aria-label="Filter test results">{[ ["all", "All cases", tests.length], ["failed", "Failed", failures], ["passed", "Passed", tests.filter(({ test }) => test.passed === true).length] ].map(([key, label, count]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{count}</span></button>)}</div>
      {visibleTests.length ? <div className="mr-test-list">{visibleTests.map(({ test, index }) => {
        const sample = Object.hasOwn(test, "input") && Object.hasOwn(test, "expected") && test.hidden !== true && test.isHidden !== true && test.type !== "hidden";
        const passed = test.passed === true;
        const failed = test.passed === false;
        return <details className="mr-test-case" key={index}><summary><span className={`mr-test-case__icon${passed ? " is-passed" : failed ? " is-failed" : ""}`}>{passed ? <Check size={14} aria-hidden="true" /> : failed ? <X size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}</span><strong>Case {isNumber(test.index) ? test.index + 1 : index + 1}</strong><span className="mr-test-kind">{sample ? "Sample" : "Hidden"}</span><span className="mr-test-verdict">{passed ? "Passed" : failed ? "Failed" : "Not recorded"}</span>{isNumber(test.timeMs) && <small>{formatNumber(test.timeMs, 2)} ms</small>}<ChevronDown size={14} aria-hidden="true" /></summary><div className="mr-test-case__body">{sample ? <div className="mr-test-values">{[["Input", test.input], ["Expected", test.expected], ["Your output", test.actual]].map(([label, value]) => <div key={label}><span className="mr-field-label">{label}</span><pre>{value == null ? "Not recorded" : String(value) || "(empty)"}</pre></div>)}</div> : <p>Hidden case inputs and expected outputs stay private.</p>}{test.error && <pre className="mr-test-error">{String(test.error)}</pre>}</div></details>;
      })}</div> : <ReportEmpty icon={CheckCircle2} title={tests.length ? `No ${filter} cases.` : "No per-test details for this duel."}>{tests.length ? "Choose another filter to review your results." : "Your aggregate test result is still shown in the score breakdown."}</ReportEmpty>}
    </section>

    <div className="mr-review-bottom"><section className="mr-panel"><ReportHeading eyebrow="THE CRAFT BEHIND THE CODE" title="Code quality" icon={Award} /><div className="mr-quality-heading"><span>Assessment</span><span>You</span><span>Rival</span></div>{["naming", "readability", "maintainability", "idioms"].map((key) => <div className="mr-quality-row" key={key}><strong>{key}</strong>{[me, rival].map((player, side) => <span className={side ? "is-rival" : ""} key={side}>{formatNumber(player.quality?.[key])}<small>/10</small></span>)}</div>)}<p className="mr-panel-footnote">AI assessment. A dash means this component was unavailable.</p></section><FeedbackCard title="Take this into your next duel" items={me.feedback} tone="tip" icon={Lightbulb} /></div>
  </div>;
}
