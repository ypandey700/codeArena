import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, CircleAlert, CircleHelp, Clock3, Code2, Flag, LoaderCircle, LockKeyhole, MessageSquare, Play, RotateCcw, Send, Swords, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useBattle, toTimestamp } from "../context/BattleContext";
import AIInterview from "../pages/AIInterview";
import Brand from "./Brand";
import api from "../services/api";
import "./BattleArena.css";

const LANGUAGES = [
  { key: "python", label: "Python", file: "solution.py", starter: "import sys\n\ndef solve():\n    data = sys.stdin.read().strip()\n    # Read the input, solve the problem, and print your answer.\n    pass\n\nif __name__ == \"__main__\":\n    solve()\n" },
  { key: "javascript", label: "JavaScript", file: "solution.js", starter: "const input = require(\"fs\").readFileSync(0, \"utf8\").trim();\n\nfunction solve(input) {\n  // Read the input, solve the problem, and print your answer.\n}\n\nsolve(input);\n" },
  { key: "cpp", label: "C++", file: "solution.cpp", starter: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Read from cin and print your answer with cout.\n    return 0;\n}\n" },
  { key: "java", label: "Java", file: "Main.java", starter: "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        // Read the input and print your answer.\n    }\n}\n" },
];
const STATUS_LABELS = { accepted: "All tests passed", wrong_answer: "Some tests failed", compile_error: "Compilation error", runtime_error: "Runtime error", time_limit: "Time limit exceeded", time_limit_exceeded: "Time limit exceeded", no_code: "No code submitted" };
const displayValue = (value) => value == null ? "Not provided" : value === "" ? "(empty)" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
const starterFor = (problem, language) => problem?.starterCode?.[language] || LANGUAGES.find((item) => item.key === language)?.starter || "";

function restoreEditor(battle, userId) {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(`battle-editor:${battle?.battleId}:${userId}`)); } catch {}
  const language = LANGUAGES.some((item) => item.key === saved?.language) ? saved.language : "python";
  const codes = Object.fromEntries(LANGUAGES.map(({ key }) => [key, typeof saved?.codes?.[key] === "string" ? saved.codes[key] : starterFor(battle?.problem, key)]));
  return { language, codes, restored: !!saved };
}

function ArenaDialog({ kind, title, onClose, children }) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(document.activeElement);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    (dialog.querySelector('[data-initial-focus]') || dialog.querySelector('button'))?.focus({ preventScroll: true });
    return () => { dialog.close(); if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={dialogRef} className={`ba-dialog ba-dialog--${kind}`} aria-labelledby="ba-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]')).filter((element) => element.getClientRects().length);
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
  }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}><header><h2 id="ba-dialog-title">{title}</h2><button type="button" className="ba-icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} aria-hidden="true" /></button></header>{children}</dialog>, document.body);
}

function ValueBlock({ label, value }) {
  return <div className="ba-value"><span>{label}</span><pre>{displayValue(value)}</pre></div>;
}

export default function BattleArena({ onExit, onQueueNext }) {
  const { user } = useAuth();
  const { activeBattle, chatMessages, sendChatMessage, opponentProgress, submissionResult, submitBattleCode, saveCodeDraft, finishBattle, forfeitBattle, opponentDisconnected, timeOffset, interview } = useBattle();
  const problem = activeBattle?.problem;
  const initialRef = useRef(null);
  if (!initialRef.current) initialRef.current = restoreEditor(activeBattle, user?._id);
  const [language, setLanguage] = useState(initialRef.current.language);
  const [code, setCode] = useState(initialRef.current.codes[initialRef.current.language]);
  const codesRef = useRef(initialRef.current.codes);
  const languageRef = useRef(initialRef.current.language);
  const editorRef = useRef(null);
  const gutterRef = useRef(null);
  const escapeTabRef = useRef(false);
  const [dialog, setDialog] = useState(null);
  const [problemTab, setProblemTab] = useState("description");
  const [view, setView] = useState("problem");
  const [testTab, setTestTab] = useState("samples");
  const [selectedCase, setSelectedCase] = useState(0);
  const [execution, setExecution] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const [actionError, setActionError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [draftStatus, setDraftStatus] = useState(initialRef.current.restored ? "local" : "starter");
  const draftTimerRef = useRef(null);
  const lastDraftAtRef = useRef(0);
  const draftVersionRef = useRef(0);
  const dirtyRef = useRef(false);
  const publishRef = useRef(null);
  const executeRef = useRef(null);
  const liveRef = useRef({});
  const mountedRef = useRef(false);
  const [chatInput, setChatInput] = useState("");
  const [seenMessages, setSeenMessages] = useState(chatMessages.length);
  const chatEndRef = useRef(null);
  const [disconnectCountdown, setDisconnectCountdown] = useState(null);

  function remainingSeconds() {
    const end = toTimestamp(activeBattle?.endsAt);
    return end ? Math.max(0, Math.floor((end - Date.now() - (timeOffset || 0)) / 1000)) : 0;
  }
  const [remaining, setRemaining] = useState(remainingSeconds);
  const ownFinished = !!activeBattle?.ownFinished || ["interview", "done"].includes(activeBattle?.myPhase);
  const finalizing = activeBattle?.status === "finalizing";
  const showInterview = !!interview?.entered || activeBattle?.myPhase === "done" || finalizing;
  const locked = ownFinished || finalizing || finishing || remaining <= 0 || !activeBattle;
  liveRef.current = { battle: activeBattle, userId: user?._id, ownFinished, finalizing, remaining, locked, saveCodeDraft, submitBattleCode, finishBattle };

  function persistEditor() {
    const state = liveRef.current;
    if (!state.battle?.battleId) return;
    try { sessionStorage.setItem(`battle-editor:${state.battle.battleId}:${state.userId}`, JSON.stringify({ language: languageRef.current, codes: codesRef.current })); } catch {}
  }

  function scheduleDraft(force = false) {
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => publishRef.current?.(force), force ? 0 : Math.max(0, 5000 - (Date.now() - lastDraftAtRef.current)));
  }

  async function publishDraft(force = false) {
    clearTimeout(draftTimerRef.current);
    const state = liveRef.current;
    if (!state.battle || state.ownFinished || state.finalizing || state.remaining <= 0) return false;
    if (!force && !dirtyRef.current) return true;
    const version = draftVersionRef.current;
    const battleId = state.battle.battleId;
    lastDraftAtRef.current = Date.now();
    setDraftStatus("saving");
    try {
      await state.saveCodeDraft({ language: languageRef.current, code: codesRef.current[languageRef.current] });
      if (!mountedRef.current || liveRef.current.battle?.battleId !== battleId) return false;
      if (draftVersionRef.current === version) dirtyRef.current = false;
      setDraftStatus(dirtyRef.current ? "unsaved" : "saved");
      setDraftError("");
      if (dirtyRef.current) scheduleDraft();
      return true;
    } catch (error) {
      if (mountedRef.current && liveRef.current.battle?.battleId === battleId && !liveRef.current.ownFinished && !liveRef.current.finalizing) {
        setDraftStatus("unsaved");
        setDraftError(error.message || "Could not save your draft.");
        if (dirtyRef.current) scheduleDraft();
      }
      return false;
    }
  }
  publishRef.current = publishDraft;

  function changed() {
    dirtyRef.current = true;
    draftVersionRef.current++;
    setDraftStatus("unsaved");
    persistEditor();
    scheduleDraft();
  }

  function updateCode(value) {
    if (liveRef.current.locked || busyRef.current) return;
    codesRef.current[languageRef.current] = value;
    setCode(value);
    changed();
  }

  function switchLanguage(value) {
    if (locked || busyRef.current || !LANGUAGES.some((item) => item.key === value)) return;
    languageRef.current = value;
    setLanguage(value);
    setCode(codesRef.current[value]);
    changed();
    scheduleDraft(true);
    if (gutterRef.current) gutterRef.current.scrollTop = 0;
  }

  useEffect(() => {
    mountedRef.current = true;
    const flush = () => { if (document.visibilityState === "hidden") publishRef.current?.(true); };
    document.addEventListener("visibilitychange", flush);
    return () => { mountedRef.current = false; document.removeEventListener("visibilitychange", flush); clearTimeout(draftTimerRef.current); };
  }, []);

  useEffect(() => {
    clearTimeout(draftTimerRef.current);
    const saved = restoreEditor(activeBattle, user?._id);
    codesRef.current = saved.codes;
    languageRef.current = saved.language;
    setLanguage(saved.language);
    setCode(saved.codes[saved.language]);
    busyRef.current = false;
    finishingRef.current = false;
    setBusy(false);
    setFinishing(false);
    dirtyRef.current = false;
    draftVersionRef.current++;
    lastDraftAtRef.current = 0;
    setDraftStatus(saved.restored ? "local" : "starter");
    setExecution(null);
    setDraftError("");
    setActionError("");
    setSelectedCase(0);
    setSeenMessages(0);
  }, [activeBattle?.battleId, problem?.slug, user?._id]);

  useEffect(() => { const tick = () => setRemaining(remainingSeconds()); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, [activeBattle?.endsAt, timeOffset]);
  useEffect(() => {
    if (ownFinished || finalizing) { clearTimeout(draftTimerRef.current); setDialog(null); }
  }, [ownFinished, finalizing]);
  useEffect(() => {
    if (!activeBattle || showInterview) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [!!activeBattle, showInterview]);
  useEffect(() => {
    if (!opponentDisconnected) { setDisconnectCountdown(null); return; }
    const deadline = Date.now() + (opponentDisconnected.graceSeconds ?? 30) * 1000;
    const tick = () => setDisconnectCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [opponentDisconnected]);
  useEffect(() => { if (dialog === "chat") { setSeenMessages(chatMessages.length); chatEndRef.current?.scrollIntoView({ block: "nearest" }); } }, [dialog, chatMessages]);
  useEffect(() => {
    const keydown = (event) => {
      if (event.defaultPrevented || event.target?.closest?.("dialog[open]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); executeRef.current?.(false); }
      else if (event.altKey && event.key === "Enter") { event.preventDefault(); executeRef.current?.(true); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, []);

  async function execute(submit = false) {
    const state = liveRef.current;
    if (busyRef.current || finishingRef.current || state.locked) return;
    const battleId = state.battle?.battleId;
    const selectedLanguage = languageRef.current;
    const source = codesRef.current[selectedLanguage];
    setTestTab("results");
    setView("tests");
    const kind = submit ? "submit" : "samples";
    if (!source?.trim()) { setExecution({ kind, error: "Write your solution before running or submitting code." }); return; }
    if (!state.battle?.problem?.slug) { setExecution({ kind, error: "The problem has not loaded. Reconnect before running your code." }); return; }
    busyRef.current = true;
    setBusy(true);
    setExecution({ kind, pending: true });
    try {
      const response = submit ? await state.submitBattleCode({ language: selectedLanguage, code: source }) : await api.post("/submissions/run", { slug: state.battle.problem.slug, language: selectedLanguage, code: source }, { timeout: 60000 });
      if (!mountedRef.current || liveRef.current.battle?.battleId !== battleId) return;
      const data = submit ? response?.data || response : response.data?.data || response.data;
      setExecution({ kind, data: { ...data, timeMs: data.executionTimeMs ?? data.timeMs } });
    } catch (error) {
      if (!mountedRef.current || liveRef.current.battle?.battleId !== battleId) return;
      setExecution({ kind, error: error.response?.status === 429 ? "Too many requests. Wait a moment, then try again." : error.response?.data?.message || (error.code === "ECONNABORTED" ? "The run timed out. Try again." : error.message || "Code could not be evaluated.") });
    } finally {
      if (mountedRef.current && liveRef.current.battle?.battleId === battleId) { busyRef.current = false; setBusy(false); }
    }
  }
  executeRef.current = execute;

  async function finish() {
    if (liveRef.current.locked || busyRef.current || finishingRef.current) return;
    setDialog(null);
    finishingRef.current = true;
    setFinishing(true);
    setActionError("");
    try { if (await publishRef.current(true)) await liveRef.current.finishBattle(); }
    catch (error) { if (mountedRef.current) setActionError(error.message || "Could not finish your solution. Try again."); }
    finally { finishingRef.current = false; if (mountedRef.current) setFinishing(false); }
  }

  function editorKeyDown(event) {
    if (event.key === "Escape") { escapeTabRef.current = true; return; }
    if (event.key !== "Tab" || locked || busyRef.current) return;
    if (escapeTabRef.current) { escapeTabRef.current = false; return; }
    event.preventDefault();
    const editor = event.currentTarget;
    const start = editor.selectionStart, end = editor.selectionEnd;
    const value = editor.value;
    if (event.shiftKey) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const count = Math.min(4, value.slice(lineStart).match(/^ */)[0].length);
      updateCode(value.slice(0, lineStart) + value.slice(lineStart + count));
      requestAnimationFrame(() => editor.setSelectionRange(Math.max(lineStart, start - count), Math.max(lineStart, end - count)));
    } else if (value.length - (end - start) + 4 <= 20000) {
      updateCode(value.slice(0, start) + "    " + value.slice(end));
      requestAnimationFrame(() => editor.setSelectionRange(start + 4, start + 4));
    }
  }

  const samples = problem?.sampleTestCases || [];
  const currentSample = samples[selectedCase];
  const ownCount = submissionResult?.totalCount ?? activeBattle?.ownProgress?.totalTests;
  const ownPassed = submissionResult?.passedCount ?? activeBattle?.ownProgress?.bestPassed;
  const opponentCount = opponentProgress?.totalCount ?? activeBattle?.opponentProgress?.totalTests;
  const opponentPassed = opponentProgress?.passedCount ?? activeBattle?.opponentProgress?.bestPassed;
  const unread = chatMessages.slice(seenMessages).filter((message) => !message.isSystem && message.from !== user?.username && message.from !== "You").length;
  const data = execution?.data;
  const languageInfo = LANGUAGES.find((item) => item.key === language);
  const savedLabels = { starter: "Starter code", local: "Restored locally", unsaved: "Unsaved changes", saving: "Saving draft…", saved: "Draft saved" };
  const timer = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  const dialogTitles = { help: "Your first duel, step by step", chat: "Match chat", reset: "Reset this language’s code?", finish: "Finish coding and start your interview?", forfeit: "Forfeit this duel?" };

  if (showInterview) return <AIInterview embedded />;
  if (!activeBattle) return <section className="ba-empty arena-page-background"><Swords size={35} aria-hidden="true" /><h1>Your next challenge is waiting.</h1><p>Join a duel to open the coding workspace.</p><div><button type="button" onClick={onQueueNext}>Find a duel</button><button type="button" onClick={onExit}>Back to the arena</button></div></section>;

  return (
    <section className="coding-arena arena-page-background" data-view={view} aria-label="Live coding duel">
      <header className="ba-topbar"><div className="ba-brand"><Brand compact /><span className="ba-mode"><Swords size={12} aria-hidden="true" />Ranked 1v1</span></div><ol className="ba-phases" aria-label="Duel stages"><li aria-current="step"><b>1</b>Code</li><ChevronRight size={12} aria-hidden="true" /><li><b>2</b>AI interview</li><ChevronRight size={12} aria-hidden="true" /><li><b>3</b>Results</li></ol><div className="ba-topbar__actions"><span className={`ba-clock${remaining <= 60 ? " is-urgent" : ""}`} role="timer" aria-label={`${remaining} seconds of coding time remaining`}><Clock3 size={14} aria-hidden="true" /><b>{timer}</b><span>left</span></span><button type="button" className="ba-icon-button" onClick={() => setDialog("help")} aria-label="How to play"><CircleHelp size={18} aria-hidden="true" /></button><button type="button" className="ba-icon-button" onClick={() => setDialog("chat")} aria-label={`Match chat${unread ? `, ${unread} unread` : ""}`}><MessageSquare size={17} aria-hidden="true" />{unread > 0 && <i className="ba-unread">{unread}</i>}</button><button type="button" className="ba-icon-button ba-forfeit" onClick={() => setDialog("forfeit")} aria-label="Forfeit duel"><Flag size={15} aria-hidden="true" /></button></div></header>

      <div className="ba-match-strip"><div className="ba-contender ba-contender--you"><span className="ba-contender__initial" aria-hidden="true">{(user?.username || "Y").slice(0, 2).toUpperCase()}</span><div><strong title={user?.username}><small>You</small>{user?.username || "You"}</strong><p>{ownCount > 0 && ownPassed != null ? `${ownPassed}/${ownCount} tests passed` : "Your solution starts here"}</p></div></div><span className="ba-match-strip__vs">VS</span><div className="ba-contender ba-contender--opponent"><div><strong title={activeBattle.opponent?.username}>{activeBattle.opponent?.username || "Opponent"}</strong><p>{activeBattle.opponentPhase === "interview" ? "In the AI interview" : activeBattle.opponentFinished ? "Finished coding" : opponentCount > 0 && opponentPassed != null ? `${opponentPassed}/${opponentCount} tests passed` : "Working on the same problem"}</p></div><span className="ba-contender__initial" aria-hidden="true">{(activeBattle.opponent?.username || "O").slice(0, 2).toUpperCase()}</span></div></div>

      {(locked || draftError || actionError || disconnectCountdown !== null || activeBattle.opponentFinished) && <div className="ba-notices" role="status"><CircleAlert size={14} aria-hidden="true" /><div>{ownFinished ? <p>Your code is locked. Preparing your AI interview…</p> : finishing ? <p>Saving and evaluating your final code…</p> : remaining <= 0 ? <p>Coding time is over. Waiting for the server to confirm the next stage…</p> : null}{draftError && !ownFinished && <p>Server draft save failed: {draftError} <button type="button" onClick={() => publishRef.current(true)}>Retry save</button></p>}{actionError && <p>{actionError}</p>}{disconnectCountdown !== null && <p>{disconnectCountdown > 0 ? `Your opponent disconnected. Reconnection time: ${disconnectCountdown}s.` : "Reconnection time ended. Waiting for the server’s decision."}</p>}{activeBattle.opponentFinished && !ownFinished && remaining > 0 && <p>Your opponent finished coding. You can keep working until your timer ends.</p>}</div></div>}

      <nav className="ba-mobile-nav" aria-label="Workspace panels">{[{ key: "problem", icon: BookOpen, label: "Problem" }, { key: "code", icon: Code2, label: "Code" }, { key: "tests", icon: CheckCircle2, label: "Tests" }].map(({ key, icon: Icon, label }) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}><Icon size={14} aria-hidden="true" />{label}{key === "tests" && busy && <LoaderCircle size={12} className="ba-spin" aria-hidden="true" />}</button>)}</nav>

      <div className="ba-workspace">
        <section className="ba-problem ba-panel" aria-labelledby="ba-problem-title"><header className="ba-problem__header"><p className="ba-step-label"><span>01</span>Read the problem</p><div><h1 id="ba-problem-title">{problem?.title || "Loading your challenge…"}</h1>{problem?.difficulty && <span className={`ba-difficulty ba-difficulty--${problem.difficulty}`}>{problem.difficulty}</span>}</div><p className="ba-problem__limits">{typeof problem?.timeLimitMs === "number" && <span>{problem.timeLimitMs / 1000}s time limit</span>}{typeof problem?.memoryLimitMb === "number" && <span>{problem.memoryLimitMb} MB memory</span>}</p></header><div className="ba-section-tabs" aria-label="Problem sections">{["description", "examples", "constraints"].map((tab) => <button key={tab} type="button" aria-pressed={problemTab === tab} onClick={() => setProblemTab(tab)}>{tab === "description" ? "Problem" : tab === "examples" ? "Examples" : "Constraints"}</button>)}</div><div className="ba-problem__body" tabIndex={0} aria-label={`${problemTab} content`}>{problemTab === "description" ? <><h2>What to build</h2><p className="ba-description">{problem?.description || "Your problem statement is loading."}</p><button type="button" className="ba-text-button" onClick={() => setProblemTab("examples")}>See an example<ArrowRight size={13} aria-hidden="true" /></button></> : problemTab === "constraints" ? <><h2>Keep these limits in mind</h2><p className="ba-description">{problem?.constraints || "No extra constraints were provided for this problem."}</p></> : samples.length ? samples.map((sample, index) => <article className="ba-example" key={index}><h2>Example {index + 1}</h2><ValueBlock label="Input" value={sample.input} /><ValueBlock label="Expected output" value={sample.expectedOutput ?? sample.expected} /></article>) : <p>No sample cases were provided.</p>}</div><footer className="ba-problem__tip"><span>Next</span>Choose a language and write your solution.<button type="button" className="ba-text-button" onClick={() => setView("code")}>Open editor<ArrowRight size={12} aria-hidden="true" /></button></footer></section>

        <div className="ba-coding-column">
          <section className="ba-editor ba-panel" aria-labelledby="ba-editor-title"><header className="ba-editor__header"><h2 className="ba-step-label" id="ba-editor-title"><span>02</span>Write your solution</h2><div><label className="ba-language-label" htmlFor="ba-language">Language</label><select id="ba-language" aria-label="Coding language" value={language} disabled={locked || busy} onChange={(event) => switchLanguage(event.target.value)}>{LANGUAGES.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select><button type="button" className="ba-icon-button" aria-label="Reset code to starter template" disabled={locked || busy} onClick={() => setDialog("reset")}><RotateCcw size={14} aria-hidden="true" /></button></div></header><div className="ba-filebar"><span><Code2 size={12} aria-hidden="true" /><span title={languageInfo.file}>{languageInfo.file}</span></span><span className={`ba-save-status${draftError ? " has-error" : ""}`} role="status">{draftStatus === "saving" ? <LoaderCircle size={10} className="ba-spin" aria-hidden="true" /> : draftStatus === "saved" ? <Check size={11} aria-hidden="true" /> : null}{savedLabels[draftStatus]}</span></div><div className="ba-editor__surface"><pre ref={gutterRef} className="ba-line-numbers" aria-hidden="true">{Array.from({ length: code.split("\n").length }, (_, index) => index + 1).join("\n")}</pre><textarea ref={editorRef} id="ba-code" aria-label={`${languageInfo.label} solution editor`} aria-describedby="ba-editor-help" value={code} readOnly={locked || busy} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" maxLength={20000} onChange={(event) => updateCode(event.target.value)} onKeyDown={editorKeyDown} onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }} /></div><div className="ba-editor__hint" id="ba-editor-help"><span>Read input → write your logic → print output.</span><span>Esc, then Tab to leave the editor</span></div></section>

          <section className="ba-tests ba-panel" aria-label="Samples and code results"><header><div className="ba-section-tabs" aria-label="Test panels"><button type="button" aria-pressed={testTab === "samples"} onClick={() => setTestTab("samples")}>Sample cases <span>{samples.length}</span></button><button type="button" aria-pressed={testTab === "results"} onClick={() => setTestTab("results")}>Results{busy && <LoaderCircle size={12} className="ba-spin" aria-hidden="true" />}</button></div><span className="ba-tests__label">03 · Test your code</span></header><div className="ba-tests__body" tabIndex={0} aria-label={testTab === "samples" ? "Sample case details" : "Execution result details"}>{testTab === "samples" ? samples.length ? <><div className="ba-case-select" aria-label="Choose a sample case">{samples.map((_, index) => <button type="button" key={index} aria-pressed={selectedCase === index} onClick={() => setSelectedCase(index)}>Case {index + 1}</button>)}</div><div className="ba-case-values"><ValueBlock label="Input" value={currentSample?.input} /><ValueBlock label="Expected output" value={currentSample?.expectedOutput ?? currentSample?.expected} /></div></> : <p className="ba-test-empty">No samples were provided. Submit your solution to check all tests.</p> : execution?.pending ? <div className="ba-test-state" role="status"><LoaderCircle size={20} className="ba-spin" aria-hidden="true" /><div><strong>{execution.kind === "submit" ? "Checking all tests…" : "Running your sample cases…"}</strong><p>Your code is being evaluated. This may take a moment.</p></div></div> : execution?.error ? <div className="ba-result-error" role="alert"><CircleAlert size={16} aria-hidden="true" /><p>{execution.error}</p></div> : data ? <div className="ba-result" aria-live="polite"><p className={data.status === "accepted" ? "ba-result__success" : "ba-result__failure"}>{data.status === "accepted" ? <CheckCircle2 size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}<strong>{STATUS_LABELS[data.status] || data.status?.replaceAll("_", " ") || "Evaluation complete"}</strong>{typeof data.passedCount === "number" && typeof data.totalCount === "number" && <span>{data.passedCount}/{data.totalCount} passed</span>}{typeof data.timeMs === "number" && <small>{data.timeMs} ms</small>}</p>{data.error && <pre className="ba-output-error">{displayValue(data.error)}</pre>}{data.testResults?.map((test, index) => <article className="ba-test-result" key={index}><p>Case {index + 1}<strong className={test.passed ? "ba-result__success" : "ba-result__failure"}>{test.passed ? "Passed" : "Failed"}</strong></p>{test.output !== undefined && <ValueBlock label="Your output" value={test.output} />}{(test.expectedOutput !== undefined || test.expected !== undefined) && <ValueBlock label="Expected" value={test.expectedOutput ?? test.expected} />}{test.error && <pre className="ba-output-error">{displayValue(test.error)}</pre>}</article>)}{execution.kind === "submit" && !data.testResults?.length && <p className="ba-results-note">Submissions check sample and hidden tests. If some fail, you can keep editing and submit again.</p>}{execution.kind === "samples" && data.status === "accepted" && <p className="ba-results-note">Samples passed. Submit your solution to check the hidden tests too.</p>}</div> : <div className="ba-test-state"><Play size={19} aria-hidden="true" /><div><strong>Give your code a first run.</strong><p>Run samples to compare your output with the examples.</p></div></div>}</div></section>

          <footer className="ba-code-actions"><p>Next: explain your code<span>Pass all tests to start your AI interview.</span></p><div><button type="button" className="ba-button ba-button--run" onClick={() => execute(false)} disabled={locked || busy} aria-keyshortcuts="Control+Enter Meta+Enter" title="Run samples (Ctrl+Enter)">{busy && execution?.kind === "samples" ? <LoaderCircle size={14} className="ba-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}Run samples</button><button type="button" className="ba-button ba-button--primary" onClick={() => execute(true)} disabled={locked || busy} aria-keyshortcuts="Alt+Enter" title="Submit solution (Alt+Enter)">{busy && execution?.kind === "submit" ? <LoaderCircle size={14} className="ba-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}Submit solution</button></div></footer>
        </div>
      </div>

      <footer className="ba-statusbar"><span><span className="ba-status-dot" />{locked ? "Editing locked" : "Coding round"}<span className="ba-statusbar__shortcut">Ctrl + Enter: run · Alt + Enter: submit</span></span><button type="button" disabled={locked || busy} onClick={() => setDialog("finish")}><LockKeyhole size={11} aria-hidden="true" />Finish coding early<ChevronRight size={12} aria-hidden="true" /></button></footer>

      {dialog && <ArenaDialog key={dialog} kind={dialog} title={dialogTitles[dialog]} onClose={() => setDialog(null)}>{dialog === "help" ? <><ol className="ba-guide"><li><b>1</b><div><strong>Read the problem.</strong><p>Check the examples and constraints to understand the expected output.</p></div></li><li><b>2</b><div><strong>Write and test your solution.</strong><p>Choose a language. Run samples as often as needed to check your work.</p></div></li><li><b>3</b><div><strong>Submit when you’re ready.</strong><p>Submit checks all tests. If all pass, your code locks and the AI interview starts. If some fail, keep improving it.</p></div></li><li><b>4</b><div><strong>Explain your approach.</strong><p>Answer questions about your code in the AI interview. You can also finish coding early; this locks and evaluates your current code.</p></div></li></ol><footer><button type="button" className="ba-button ba-button--primary" onClick={() => setDialog(null)}>Let’s code<ArrowRight size={14} aria-hidden="true" /></button></footer></> : dialog === "chat" ? <><div className="ba-chat-stream" aria-live="polite">{chatMessages.length ? chatMessages.map((message, index) => <article key={index} className={`ba-chat-message${message.isSystem ? " is-system" : message.from === user?.username || message.from === "You" ? " is-own" : ""}`}><strong>{message.isSystem ? "Match notice" : message.from === user?.username ? "You" : message.from}</strong><p>{message.text}</p></article>) : <div className="ba-chat-empty"><MessageSquare size={25} aria-hidden="true" /><strong>A little sportsmanship goes a long way.</strong><p>Say hello to {activeBattle.opponent?.username || "your opponent"}.</p></div>}<div ref={chatEndRef} /></div><form className="ba-chat-form" onSubmit={(event) => { event.preventDefault(); const text = chatInput.trim(); if (!text) return; sendChatMessage(text); setChatInput(""); }}><label className="ba-sr-only" htmlFor="ba-chat-input">Message your opponent</label><input id="ba-chat-input" data-initial-focus value={chatInput} onChange={(event) => setChatInput(event.target.value)} maxLength={500} placeholder="Message your opponent…" autoComplete="off" /><button type="submit" className="ba-button ba-button--primary" disabled={!chatInput.trim()} aria-label="Send message"><Send size={15} aria-hidden="true" /></button></form></> : <><div className="ba-dialog__copy">{dialog === "finish" ? <p>Your latest code will be evaluated against all tests, then your AI interview begins. <strong>You won’t be able to edit or resubmit after finishing.</strong></p> : dialog === "reset" ? <p>This replaces your {languageInfo.label} code with its starter template. Your code in the other languages stays saved.</p> : <p>Forfeiting ends this duel and gives your opponent the victory. This cannot be undone.</p>}</div><footer><button type="button" data-initial-focus className="ba-button" onClick={() => setDialog(null)}>{dialog === "reset" ? "Keep my code" : "Keep coding"}</button><button type="button" className={`ba-button${dialog === "forfeit" ? " ba-button--danger" : " ba-button--primary"}`} onClick={() => { if (dialog === "finish") finish(); else if (dialog === "reset") { updateCode(starterFor(problem, language)); setDialog(null); } else { setDialog(null); forfeitBattle((message) => setActionError(message)); } }}>{dialog === "finish" ? "Finish & interview" : dialog === "reset" ? "Reset code" : "Forfeit duel"}</button></footer></>}</ArenaDialog>}
    </section>
  );
}
