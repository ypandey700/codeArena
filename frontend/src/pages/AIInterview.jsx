import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, AudioLines, Check, CheckCircle2, ChevronRight, CircleAlert, Clock3, Code2, FileCode2, Keyboard, LoaderCircle, LockKeyhole, MessageSquare, Mic, Pause, RotateCcw, Send, ShieldCheck, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useBattle } from "../context/BattleContext";
import { useAuth } from "../context/AuthContext";
import useInterviewSession, { PREPARATION_SECONDS } from "../hooks/useInterviewSession";
import Brand from "../components/Brand";
import "./AIInterview.css";
import InterviewSetup from "../components/InterviewSetup";
import SurrenderBattle from "../components/SurrenderBattle";

const LANGUAGES = { python: { name: "Python", file: "solution.py" }, javascript: { name: "JavaScript", file: "solution.js" }, cpp: { name: "C++", file: "solution.cpp" }, java: { name: "Java", file: "Main.java" } };
const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function VoiceOrb({ active, preparing }) {
  return <div className={`iv-voice-orb${active ? " is-active" : ""}${preparing ? " is-preparing" : ""}`} aria-hidden="true"><span /><span /><div>{[10, 18, 28, 38, 25, 16, 32, 22, 12].map((height, index) => <i key={index} style={{ "--iv-bar-height": `${height}px`, animationDelay: `${index * 95}ms` }} />)}</div></div>;
}

export default function AIInterview({ embedded = false }) {
  const { user } = useAuth();
  const { activeBattle, battleResult, duelState, interview, joinInterview, answerInterview, submissionResult, timeOffset, resultSync, refreshBattleResult, setDuelState } = useBattle();
  const navigate = useNavigate();
  const [reference, setReference] = useState("code");
  const [mobileView, setMobileView] = useState("interview");
  const [savingSeconds, setSavingSeconds] = useState(0);
  const question = interview?.question;
  const battleId = activeBattle?.battleId;
  const total = interview?.total;
  const history = interview?.history || [];
  const done = activeBattle?.myPhase === "done" || ["done", "skipped", "failed"].includes(interview?.status);
  const finalizing = activeBattle?.status === "finalizing";
  const thinking = !done && !finalizing && (interview?.thinking || !question);
  const session = useInterviewSession({ battleId, userId: user?._id || user?.id, question, interviewDeadlineAt: interview?.interviewDeadlineAt, timeOffset, done, finalizing, thinking, answerInterview, joinInterview });
  let finalCode = typeof interview?.finalCode === "string" ? interview.finalCode : null;
  let language = activeBattle?.language || "";
  if (battleId && user?._id) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(`battle-code:${battleId}:${user._id}`));
      if (finalCode === null && typeof saved?.code === "string") finalCode = saved.code;
      language = saved?.language || language;
    } catch {}
  }
  const languageInfo = LANGUAGES[language] || { name: language || "Submitted solution", file: "Your final code" };
  const testsPassed = activeBattle?.ownProgress?.bestPassed ?? submissionResult?.passedCount;
  const testsTotal = activeBattle?.ownProgress?.totalTests ?? submissionResult?.totalCount;
  const opponent = activeBattle?.opponent?.username || "Your rival";
  const opponentPhase = activeBattle?.opponentPhase;
  const opponentQuestion = activeBattle?.opponentInterview;
  const opponentLabel = opponentPhase === "interview" ? Number.isInteger(opponentQuestion?.questionIndex) && opponentQuestion?.total ? `Interview ${opponentQuestion.questionIndex + 1}/${opponentQuestion.total}` : "In the interview" : opponentPhase === "done" ? "Interview complete" : "Still coding";
  const preparing = !done && !finalizing && !thinking && session.phase === "preparing";
  const reading = !done && !finalizing && !thinking && session.phase === "reading";
  const answering = !done && !finalizing && !thinking && session.phase === "answering";
  const recording = answering && session.capture === "listening";
  const settling = answering && session.capture === "stopping";
  const starting = answering && ["starting", "permission"].includes(session.capture);
  const voiceMode = session.mode === "voice" && session.voiceAvailable;
  const willRecord = voiceMode && session.autoRecord && !session.paused;
  const checkingResult = resultSync?.battleId === battleId && resultSync.checking;
  const resultError = resultSync?.battleId === battleId ? resultSync.error : "";
  const savingDelayed = finalizing && savingSeconds >= 20;
  const answeredIndices = new Set(history.map((item) => item.index));
  const progressStart = Math.max(0, Math.min((question?.index || 0) - 2, Math.max(0, (total || 0) - 5)));

  useEffect(() => {
    if (!embedded && battleResult && !activeBattle && duelState === "report_full") navigate("/match-report");
  }, [embedded, battleResult, activeBattle, duelState, navigate]);
  useEffect(() => {
    if (!activeBattle) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [Boolean(activeBattle)]);
  useEffect(() => {
    setSavingSeconds(0);
    if (!finalizing) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setSavingSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [battleId, finalizing]);

  if (!activeBattle) return <section className="interview-studio iv-empty"><span><MessageSquare size={34} strokeWidth={1.3} aria-hidden="true" /></span><p className="iv-eyebrow">THE THINKING BEHIND YOUR CODE</p><h1>Your interview room is waiting.</h1><p>Open your active duel to resume the interview.</p><Link className="iv-button iv-button--primary" to="/dashboard" onClick={() => setDuelState?.("closed")}><ArrowLeft size={14} aria-hidden="true" />Command Deck</Link></section>;

  if (!session.ready && !done && !finalizing) return <InterviewSetup session={session} title={activeBattle.problem?.title} hasQuestion={Boolean(question)} surrenderAction={<SurrenderBattle onOpen={session.pauseRecording} />} />;

  const status = finalizing ? "Saving match result" : done ? "Interview complete" : thinking || session.phase === "waiting" ? "Preparing your next question" : reading ? "Listen to your question" : preparing ? willRecord ? "Recording starts in a moment" : "Take a moment to prepare" : recording ? "Recording your answer" : settling ? "Finishing your transcript" : starting ? "Starting your microphone" : voiceMode ? "Microphone paused" : "Type your answer";
  return <section className="interview-studio" data-mobile-view={mobileView} data-phase={finalizing ? "finalizing" : done ? "complete" : thinking ? "thinking" : session.phase} data-capture={session.capture} aria-label="Live AI interview">
    <header className="iv-topbar"><div className="iv-brand"><Brand compact /><span><MessageSquare size={12} aria-hidden="true" />AI code interview</span></div><ol className="iv-phases" aria-label="Duel stages"><li><b><Check size={10} aria-hidden="true" /></b>Code</li><ChevronRight size={12} aria-hidden="true" /><li aria-current="step"><b>2</b>Interview</li><ChevronRight size={12} aria-hidden="true" /><li><b>3</b>Results</li></ol><div className="iv-topbar__actions"><SurrenderBattle onOpen={session.pauseRecording} /><button type="button" className="iv-auto-switch" role="switch" aria-checked={session.autoRecord && session.voiceAvailable} disabled={!session.voiceAvailable || done || finalizing} onClick={session.toggleAutoRecord} title="Automatically record after the five-second preparation"><span><i /></span>Auto-record</button><button type="button" className="iv-icon-button" disabled={!session.playbackAvailable || done || finalizing} onClick={session.toggleVoice} aria-label={session.voiceEnabled ? "Turn question audio off" : "Turn question audio on"}>{session.voiceEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}</button><div className={`iv-clock${answering && session.remaining <= 10 ? " is-urgent" : ""}`} role="timer" aria-label={done || finalizing ? "Interview complete" : `${session.remaining} seconds of answer time remaining`}><Clock3 size={14} aria-hidden="true" /><div><small>{done || finalizing ? "Completed" : "Answer time"}</small><strong>{done || finalizing ? <Check size={16} aria-hidden="true" /> : thinking ? "—:—" : clock(session.remaining)}</strong></div></div></div></header>

    <div className="iv-session-strip"><div className="iv-challenge"><span><Code2 size={16} aria-hidden="true" /></span><div><strong title={activeBattle.problem?.title}>{activeBattle.problem?.title || "Ranked duel"}</strong><p>{Number.isInteger(question?.index) ? `Question ${question.index + 1} of ${total ?? "—"}` : done || finalizing ? "Your interview is complete" : "Preparing your interview"}</p></div></div><div className="iv-question-progress" aria-label={`${history.length} recorded answers${total ? ` of ${total}` : ""}`}>{Array.from({ length: Math.min(5, Number.isInteger(total) && total > 0 ? total : 0) }, (_, offset) => offset + progressStart).map((index) => <span key={index} title={`Question ${index + 1}`} className={answeredIndices.has(index) ? "is-complete" : index === question?.index ? "is-current" : ""}>{answeredIndices.has(index) ? <Check size={10} aria-hidden="true" /> : index + 1}</span>)}</div><div className="iv-rival"><span /><strong>{opponent}</strong><small>{opponentLabel}</small></div></div>

    <nav className="iv-mobile-nav" aria-label="Interview workspace"><button type="button" aria-pressed={mobileView === "interview"} onClick={() => setMobileView("interview")}><MessageSquare size={14} aria-hidden="true" />Interview</button><button type="button" aria-pressed={mobileView === "reference"} onClick={() => setMobileView("reference")}><FileCode2 size={14} aria-hidden="true" />Code & answers</button></nav>

    <div className="iv-workspace">
      <aside className="iv-reference iv-panel" aria-label="Your code and recorded answers"><div className="iv-reference__tabs"><button type="button" aria-pressed={reference === "code"} onClick={() => setReference("code")}><FileCode2 size={13} aria-hidden="true" />Submitted code</button><button type="button" aria-pressed={reference === "answers"} onClick={() => setReference("answers")}><MessageSquare size={13} aria-hidden="true" />Your answers<span>{history.length}</span></button></div>{reference === "code" ? <><div className="iv-filebar"><span><Code2 size={12} aria-hidden="true" /><strong>{languageInfo.file}</strong></span><span><LockKeyhole size={10} aria-hidden="true" />Read only</span></div><div className="iv-code-scroll" tabIndex={0} aria-label="Your submitted code, read only">{typeof finalCode === "string" && finalCode ? <div className="iv-code-lines">{finalCode.split("\n").map((line, index) => <div key={index}><span aria-hidden="true">{index + 1}</span><code>{line || "\n"}</code></div>)}</div> : <div className="iv-reference-empty"><FileCode2 size={29} strokeWidth={1.3} aria-hidden="true" /><strong>{finalCode === null ? "Loading your solution…" : "No code was submitted."}</strong><p>Your submitted solution stays here while you explain it.</p></div>}</div><footer><span><ShieldCheck size={12} aria-hidden="true" />Your final solution</span>{Number.isFinite(testsPassed) && Number.isFinite(testsTotal) && <span>{testsPassed}/{testsTotal} tests passed</span>}</footer></> : <div className="iv-answer-history" tabIndex={0} aria-label="Your recorded interview answers">{history.length ? history.map((entry) => <article key={entry.index}><span>QUESTION {String(entry.index + 1).padStart(2, "0")}<small>{entry.status === "skipped" ? "Skipped" : entry.status === "expired" ? "Time expired" : "Recorded"}</small></span><h3>{entry.text || entry.question}</h3><p>{entry.status === "skipped" ? "You skipped this question." : entry.answer || "No answer was recorded."}</p></article>) : <div className="iv-reference-empty"><MessageSquare size={29} strokeWidth={1.3} aria-hidden="true" /><strong>Your story is just starting.</strong><p>Completed answers appear here after each question.</p></div>}</div>}</aside>

      <div className="iv-interview-column">
        <div className="iv-host-card"><div className="iv-host-avatar" aria-hidden="true"><Sparkles size={23} strokeWidth={1.4} /></div><div><p className="iv-eyebrow">YOUR AI INTERVIEWER</p><h1>Dr. Evelyn Vance<span>.</span></h1><p>{status}</p></div><VoiceOrb active={session.speaking || recording} preparing={preparing} /></div>

        {done || finalizing ? <div className="iv-completion iv-panel" role="status"><span className={`iv-completion__icon${finalizing ? " is-saving" : ""}`}>{finalizing ? <LoaderCircle size={35} className="iv-spin" aria-hidden="true" /> : <CheckCircle2 size={35} strokeWidth={1.3} aria-hidden="true" />}</span><p className="iv-eyebrow">{finalizing ? "THE LAST STEP" : "YOUR PART IS COMPLETE"}</p><h2>{finalizing ? savingDelayed ? "Your result is taking longer to save." : "Bringing the result together." : "Your interview is complete."}</h2><p>{finalizing ? savingDelayed ? "The server is still saving this match. Your code and answers remain available while we keep checking." : "The interviews have ended. Saving the final match and rating updates." : `Waiting for ${opponent} to finish. You can review your code and answers here.`}</p><span className="iv-completion__rival"><span />{opponent}<b>{opponentLabel}</b></span>{resultError && <p className="iv-completion__error" role="alert">{resultError}</p>}<button type="button" className="iv-button" disabled={checkingResult} onClick={() => refreshBattleResult?.()}>{checkingResult ? <LoaderCircle size={14} className="iv-spin" aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}{checkingResult ? "Checking result…" : "Check result again"}</button><button type="button" className="iv-text-button iv-mobile-review" onClick={() => { setReference("answers"); setMobileView("reference"); }}>Review your answers<ArrowRight size={13} aria-hidden="true" /></button></div> : <>
          <section className={`iv-question iv-panel${preparing ? " is-preparing" : ""}`} aria-labelledby="iv-question-title"><div className="iv-question__top"><span><MessageSquare size={13} aria-hidden="true" />{Number.isInteger(question?.index) ? `QUESTION ${String(question.index + 1).padStart(2, "0")}` : "YOUR NEXT QUESTION"}</span>{question && <button type="button" className="iv-text-button" onClick={session.replayQuestion} disabled={reading || preparing || session.sending || !session.voiceEnabled}>{reading ? <AudioLines size={12} aria-hidden="true" /> : <RotateCcw size={12} aria-hidden="true" />}{reading ? "Reading" : "Replay"}</button>}</div><div className="iv-question__content"><h2 id="iv-question-title">{thinking || session.phase === "waiting" ? "A moment to think about your code…" : question?.text || "Your question is on its way."}</h2>{preparing && <div className="iv-preparation" role="status" aria-live="polite"><div className="iv-preparation__ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" /><circle cx="32" cy="32" r="27" pathLength="100" strokeDasharray={`${session.preparation / PREPARATION_SECONDS * 100} 100`} /></svg><strong>{session.preparation}</strong></div><div><strong>Take a moment.</strong><p>{willRecord ? `Recording starts in ${session.preparation}s.` : `Your answer time starts in ${session.preparation}s.`}</p><small>{willRecord ? "Your mic will open automatically." : voiceMode ? "Choose Resume recording when ready." : "Get ready to type your explanation."}</small></div></div>}</div><ol className="iv-flow" aria-label="Question flow"><li className={reading ? "is-active" : !thinking ? "is-complete" : ""}><span>{reading ? <AudioLines size={11} aria-hidden="true" /> : <Check size={10} aria-hidden="true" />}</span>Listen</li><ChevronRight size={11} aria-hidden="true" /><li className={preparing ? "is-active" : answering || session.sending ? "is-complete" : ""}><span>{preparing ? session.preparation : "2"}</span>Think · 5s</li><ChevronRight size={11} aria-hidden="true" /><li className={answering ? "is-active" : ""}><span>{recording ? <Mic size={10} aria-hidden="true" /> : "3"}</span>Answer</li></ol></section>

          <section className="iv-response iv-panel" aria-label="Your answer"><header><div><span className={`iv-record-dot${recording ? " is-live" : ""}`} /><h2>{voiceMode ? "Live transcript" : "Your answer"}</h2><small>{recording ? "REC" : starting ? "CONNECTING" : settling ? "FINISHING" : session.sending ? "SENDING" : ""}</small></div><div className="iv-input-modes" aria-label="Answer input mode"><button type="button" aria-pressed={session.mode === "voice"} onClick={() => session.chooseMode("voice")} disabled={!session.voiceAvailable || session.sending}><Mic size={12} aria-hidden="true" />Speak</button><button type="button" aria-pressed={session.mode === "typed"} onClick={() => session.chooseMode("typed")} disabled={session.sending}><Keyboard size={13} aria-hidden="true" />Type</button></div></header><label className="iv-sr-only" htmlFor="interview-answer">Your interview answer</label><textarea id="interview-answer" value={session.answer} maxLength={2000} readOnly={!answering || recording || starting || settling} onChange={(event) => session.changeAnswer(event.target.value)} onPaste={(event) => { event.preventDefault(); session.setNotice("Paste is disabled. Please speak or type your own explanation."); }} onDrop={(event) => { event.preventDefault(); session.setNotice("Drop is disabled. Please speak or type your own explanation."); }} onDragOver={(event) => event.preventDefault()} placeholder={thinking ? "Your next question is being prepared…" : reading ? "Listen first. You’ll have five seconds to prepare." : preparing ? willRecord ? "Your microphone will start after the countdown." : "Take a moment to organise your thoughts." : voiceMode ? "Your words appear here as you speak. Pause recording to edit." : "Explain your approach in your own words…"} aria-describedby="iv-response-hint" /><div className="iv-response__meta" id="iv-response-hint"><span>{recording ? "Listening. Speak naturally." : voiceMode && answering ? "You can edit your transcript while paused." : "Explain the decisions behind your solution."}</span><span>{session.answer.length}/2000</span></div></section>

          {(session.notice || session.error || (voiceMode && session.permission !== "granted")) && <div className="iv-notices" role={session.error ? "alert" : "status"}><CircleAlert size={14} aria-hidden="true" /><div>{session.notice && <p>{session.notice}</p>}{session.error && <p className="iv-error">{session.error}</p>}{!session.notice && voiceMode && session.permission !== "granted" && <p>Allow microphone access once for automatic voice answers.</p>}{voiceMode && session.permission !== "granted" && <button type="button" className="iv-text-button" disabled={session.permissionBusy} onClick={session.enableMicrophone}>{session.permissionBusy ? <LoaderCircle size={12} className="iv-spin" aria-hidden="true" /> : <Mic size={12} aria-hidden="true" />}{session.permissionBusy ? "Waiting for permission…" : "Enable microphone"}</button>}{session.error && <button type="button" className="iv-text-button" onClick={() => joinInterview().then(() => session.setError("")).catch((error) => session.setError(error.message))}><RotateCcw size={12} aria-hidden="true" />Resume interview</button>}</div></div>}

          <footer className="iv-answer-actions"><div>{voiceMode ? <button type="button" className={`iv-mic-button${recording ? " is-recording" : ""}`} disabled={!answering || starting || settling || session.sending} onClick={recording ? session.pauseRecording : session.resumeRecording} aria-keyshortcuts="Space Escape" aria-label={recording ? "Pause recording" : "Resume recording"}>{recording ? <Pause size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}<span>{recording ? "Pause recording" : starting ? "Starting mic…" : "Resume recording"}</span></button> : <span className="iv-typed-label"><Keyboard size={16} aria-hidden="true" />Typed answer</span>}</div><div><button type="button" className="iv-button iv-button--skip" disabled={session.sending || !question || thinking} onClick={() => session.submit({ skip: true })}>Skip question</button><button type="button" className="iv-button iv-button--primary" disabled={!answering || session.sending} onClick={() => session.submit()}>{session.sending ? <LoaderCircle size={14} className="iv-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}<span>{session.sending ? "Sending…" : Number.isInteger(total) && question?.index === total - 1 ? "Finish interview" : "Submit answer"}</span><ArrowRight size={14} aria-hidden="true" /></button></div></footer>
        </>}
      </div>
    </div>
    <footer className="iv-statusbar"><span><span />{finalizing ? "Saving result" : done ? "Interview completed" : "Your code. Your reasoning."}</span><span>{session.voiceAvailable ? "Spoken answers are converted to text." : "Voice input unavailable · typing is ready."}<i /><span>Skipped questions earn zero.</span></span></footer>
  </section>;
}
