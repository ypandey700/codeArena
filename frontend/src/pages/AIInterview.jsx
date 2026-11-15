import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AudioLines, CheckCircle2, CircleStop, MessageSquare, Mic, MicOff, Send, Timer, UserRound, Volume2, VolumeX } from "lucide-react";
import { useBattle, toTimestamp } from "../context/BattleContext";
import { useAuth } from "../context/AuthContext";

const portrait = "https://lh3.googleusercontent.com/aida-public/AB6AXuAboQvrM1yaEPgCCrJLfF6T6BkHamG_6Nr_IdwnzFh7zvgxr7tk9EKeexT5T8_o3esB5MCwpuSfpmD5PCDEFdH-VivNrqSbosz5l38Ae13sNZFMqToWZTfNBFafusfE3JZrLDdcHWCP_YsDoEOeADRPsmbXkkJA1nbaTDG3bbKw5Urr94DzDayLxI3IdK6kCMLs_AKr-bJNBKBBAoKlf1am3BaaMKD8pBhR2OwV1QN0";

export default function AIInterview({ embedded = false }) {
  const { user } = useAuth();
  const { activeBattle, battleResult, duelState, interview, joinInterview, answerInterview, submissionResult, timeOffset } = useBattle();
  const navigate = useNavigate();
  const question = interview?.question;
  const battleId = activeBattle?.battleId;
  const history = interview?.history || [];
  const total = interview?.total;
  let finalCode = typeof interview?.finalCode === "string" ? interview.finalCode : null;
  if (finalCode === null && battleId && user?._id) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(`battle-code:${battleId}:${user._id}`));
      if (typeof saved?.code === "string") finalCode = saved.code;
    } catch {}
  }
  const done = activeBattle?.myPhase === "done" || ["done", "skipped", "failed"].includes(interview?.status);
  const finalizing = activeBattle?.status === "finalizing";
  const thinking = !done && !finalizing && (interview?.thinking || !question);
  const step = question?.index;
  const questionKey = question ? `${battleId}:${user?._id}:${question.index}` : "";
  const [answer, setAnswer] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState("");
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const [answerError, setAnswerError] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
  const [micUnavailable, setMicUnavailable] = useState(() => !(window.SpeechRecognition || window.webkitSpeechRecognition));
  const speechRef = useRef(null);
  const recognitionRef = useRef(null);
  const captionTimerRef = useRef(null);
  const playbackTimerRef = useRef(null);
  const answerRef = useRef("");
  const inputModeRef = useRef("typed");
  const answerEndRef = useRef(0);
  const readingRef = useRef(false);
  const sendingRef = useRef(false);
  const autoSentRef = useRef(false);
  const mountedRef = useRef(true);
  const liveRef = useRef({});
  const sendRef = useRef(null);
  liveRef.current = { question, key: questionKey, done, finalizing, thinking, timeOffset, interviewDeadlineAt: interview?.interviewDeadlineAt };
  const testsPassed = activeBattle?.ownProgress?.bestPassed ?? submissionResult?.passedCount;
  const testsTotal = activeBattle?.ownProgress?.totalTests ?? submissionResult?.totalCount;
  const opponent = activeBattle?.opponent?.username || "your opponent";
  const opponentStatus = activeBattle?.opponentPhase || "coding";
  const opponentQuestion = activeBattle?.opponentInterview;
  const phaseLabel = opponentStatus === "interview" && Number.isInteger(opponentQuestion?.questionIndex) && opponentQuestion?.total ? `interview Q${opponentQuestion.questionIndex + 1}/${opponentQuestion.total}` : opponentStatus;

  function stopMic() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) { recognition.onend = null; recognition.abort(); }
    if (mountedRef.current) setListening(false);
  }

  function stopMedia() {
    stopMic();
    speechRef.current = null;
    readingRef.current = false;
    clearInterval(captionTimerRef.current);
    clearTimeout(playbackTimerRef.current);
    window.speechSynthesis?.cancel();
    if (mountedRef.current) setSpeaking(false);
  }

  function serverLimit() {
    const current = liveRef.current;
    return Math.min(toTimestamp(current.question?.deadlineAt) || Infinity, toTimestamp(current.interviewDeadlineAt) || Infinity) - 300;
  }

  function startAnswerClock() {
    const current = liveRef.current;
    if (!current.question || !current.key) return;
    const interval = (toTimestamp(current.question.deadlineAt) - toTimestamp(current.question.askedAt)) / 1000;
    const allowanceValue = Number(import.meta.env.VITE_INTERVIEW_READ_ALLOWANCE_SECONDS ?? 15);
    const configured = Number(import.meta.env.VITE_INTERVIEW_QUESTION_SECONDS);
    const derived = interval > allowanceValue ? interval - allowanceValue : interval;
    const seconds = configured > 0 ? configured : derived > 0 ? derived : 90;
    if (!answerEndRef.current) {
      answerEndRef.current = Math.min(Date.now() + current.timeOffset + seconds * 1000, serverLimit());
      try { sessionStorage.setItem(`interview-clock:${current.key}`, String(answerEndRef.current)); } catch {}
    }
  }

  function finishReading(text) {
    readingRef.current = false;
    clearInterval(captionTimerRef.current);
    clearTimeout(playbackTimerRef.current);
    setSpeaking(false);
    setCaption(text);
    startAnswerClock();
  }

  function stopQuestion() {
    const text = liveRef.current.question?.text || "";
    speechRef.current = null;
    window.speechSynthesis?.cancel();
    finishReading(text);
  }

  function typeQuestion(text) {
    clearInterval(captionTimerRef.current);
    let length = 0;
    setCaption("");
    captionTimerRef.current = setInterval(() => {
      length = Math.min(text.length, length + 2);
      setCaption(text.slice(0, length));
      if (length === text.length) {
        clearInterval(captionTimerRef.current);
        if (!speechRef.current && readingRef.current) finishReading(text);
      }
    }, 35);
  }

  function readQuestion() {
    const current = liveRef.current;
    if (!current.question || current.done || current.finalizing || current.thinking) return;
    const text = current.question.text;
    const key = current.key;
    stopMedia();
    readingRef.current = true;
    typeQuestion(text);
    if (!voiceEnabled || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      if (!("speechSynthesis" in window)) setNotice("Voice playback is unavailable. Read the question and type your answer.");
      return;
    }
    const speech = new window.SpeechSynthesisUtterance(text);
    speechRef.current = speech;
    readingRef.current = true;
    setSpeaking(true);
    speech.rate = 0.95;
    speech.onstart = () => { if (speechRef.current === speech) clearTimeout(playbackTimerRef.current); };
    speech.onboundary = (event) => {
      if (speechRef.current !== speech || event.name !== "word") return;
      clearInterval(captionTimerRef.current);
      const end = text.indexOf(" ", event.charIndex);
      setCaption(text.slice(0, end < 0 ? text.length : end));
    };
    const finish = () => {
      if (speechRef.current !== speech || liveRef.current.key !== key) return;
      speechRef.current = null;
      finishReading(text);
    };
    speech.onend = finish;
    speech.onerror = () => {
      if (speechRef.current !== speech) return;
      finish();
      setVoiceEnabled(false);
      setNotice("Voice playback is unavailable or blocked. You can read the question and type.");
    };
    playbackTimerRef.current = setTimeout(() => {
      if (speechRef.current !== speech) return;
      speechRef.current = null;
      window.speechSynthesis.cancel();
      finishReading(text);
      setVoiceEnabled(false);
      setNotice("Voice playback did not start. Read the question and type your answer.");
    }, 2500);
    try { window.speechSynthesis.speak(speech); } catch {
      speechRef.current = null;
      finishReading(text);
      setVoiceEnabled(false);
      setNotice("Voice playback is unavailable. Read the question and type your answer.");
    }
  }

  function saveAnswer(text) {
    const value = text.slice(0, 2000);
    answerRef.current = value;
    setAnswer(value);
    if (liveRef.current.key) {
      try { sessionStorage.setItem(`interview-answer:${liveRef.current.key}`, JSON.stringify({ text: value, inputMode: inputModeRef.current })); } catch {}
    }
  }

  function toggleMic() {
    const current = liveRef.current;
    if (readingRef.current || !current.question || current.done || current.finalizing || current.thinking || sendingRef.current || Date.now() + current.timeOffset >= Math.min(answerEndRef.current || Infinity, serverLimit())) return;
    if (recognitionRef.current) { stopMic(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition || micUnavailable) { setNotice("Voice input is unavailable. Please type your answer."); return; }
    const recognition = new Recognition();
    const key = current.key;
    const base = answerRef.current;
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => { if (recognitionRef.current === recognition) { setListening(true); setNotice(""); } };
    recognition.onend = () => { if (recognitionRef.current === recognition) { recognitionRef.current = null; setListening(false); } };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      stopMic();
      if (["not-allowed", "service-not-allowed"].includes(event.error)) setMicUnavailable(true);
      setNotice("Microphone input is unavailable or permission was denied. Please type your answer.");
    };
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition || liveRef.current.key !== key) return;
      let transcript = "";
      for (let index = 0; index < event.results.length; index++) transcript += `${event.results[index][0].transcript} `;
      if (transcript.trim()) {
        inputModeRef.current = "voice";
        saveAnswer(`${base}${base ? " " : ""}${transcript.trim()}`);
      }
    };
    try { recognition.start(); } catch {
      stopMic();
      setMicUnavailable(true);
      setNotice("Microphone input could not start. Please type your answer.");
    }
  }

  async function send(event, automatic = false, skip = false) {
    event?.preventDefault();
    const current = liveRef.current;
    if (!current.question || current.done || current.finalizing || current.thinking || sendingRef.current || readingRef.current && !automatic && !skip) return;
    const key = current.key;
    const questionIndex = current.question.index;
    const text = answerRef.current;
    const inputMode = inputModeRef.current;
    stopMedia();
    setCaption(current.question.text);
    sendingRef.current = true;
    setSending(true);
    setAnswerError("");
    try {
      await answerInterview({ questionIndex, text, inputMode, skip });
    } catch (error) {
      if (liveRef.current.key === key) setAnswerError(error.message);
      joinInterview().catch(() => {});
    } finally {
      if (mountedRef.current && (liveRef.current.key === key || !liveRef.current.question)) {
        sendingRef.current = false;
        setSending(false);
      }
    }
  }
  sendRef.current = send;

  useEffect(() => {
    mountedRef.current = true;
    const leave = () => { if (liveRef.current.question && readingRef.current) stopQuestion(); stopMedia(); };
    window.addEventListener("pagehide", leave);
    return () => { mountedRef.current = false; stopMedia(); window.removeEventListener("pagehide", leave); };
  }, []);

  useEffect(() => {
    if (!embedded && battleResult && !activeBattle && duelState === "report_full") navigate("/match-report");
  }, [embedded, battleResult, activeBattle, duelState, navigate]);

  useEffect(() => {
    if (!battleId) return;
    const resume = () => joinInterview().catch((error) => { if (mountedRef.current) setAnswerError(error.message); });
    resume();
    const timer = setInterval(() => { if (liveRef.current.thinking && document.visibilityState === "visible") resume(); }, 5000);
    return () => clearInterval(timer);
  }, [battleId, joinInterview]);

  useEffect(() => {
    stopMedia();
    sendingRef.current = false;
    autoSentRef.current = false;
    answerEndRef.current = 0;
    inputModeRef.current = "typed";
    setSending(false);
    setAnswerError("");
    if (!questionKey) { answerRef.current = ""; setAnswer(""); setCaption(""); return; }
    let savedAnswer = "";
    try {
      const saved = sessionStorage.getItem(`interview-answer:${questionKey}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          savedAnswer = typeof parsed.text === "string" ? parsed.text : "";
          inputModeRef.current = parsed.inputMode === "voice" ? "voice" : "typed";
        } catch { savedAnswer = saved; }
      }
      answerEndRef.current = Number(sessionStorage.getItem(`interview-clock:${questionKey}`)) || 0;
    } catch {}
    answerRef.current = savedAnswer;
    setAnswer(savedAnswer);
    if (answerEndRef.current) { setCaption(question.text); }
    else readQuestion();
    return stopMedia;
  }, [questionKey, question?.text, question?.deadlineAt]);

  useEffect(() => {
    if (!questionKey) return;
    const tick = () => {
      const current = liveRef.current;
      if (!current.question || current.key !== questionKey || current.done || current.finalizing || current.thinking) return;
      const deadline = Math.min(answerEndRef.current || Infinity, serverLimit());
      const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now() - current.timeOffset) / 1000));
      setRemaining(secondsLeft);
      if (secondsLeft === 0 && !autoSentRef.current) {
        autoSentRef.current = true;
        sendRef.current(null, true);
      }
    };
    tick();
    const timer = setInterval(tick, 200);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [questionKey]);

  useEffect(() => {
    const keydown = (event) => {
      if (event.code !== "Space" || event.repeat || event.target instanceof HTMLElement && (/^(INPUT|TEXTAREA|BUTTON|SELECT|A)$/.test(event.target.tagName) || event.target.isContentEditable)) return;
      event.preventDefault();
      toggleMic();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [questionKey, micUnavailable]);

  useEffect(() => {
    if (done || finalizing || thinking) stopMedia();
  }, [done, finalizing, thinking]);

  if (!activeBattle) return <div className="min-h-[calc(100vh-64px)] bg-[#111414] p-8 text-center text-[#fddf49]"><p>No active interview. Resume your duel from the battle room.</p><Link to="/dashboard" className="mt-4 inline-block underline">Back to Command Deck</Link></div>;

  return <div className="min-h-[calc(100vh-64px)] bg-[#111414] px-4 py-6 sm:px-6 sm:py-8">
    <section className="mx-auto max-w-[1000px] rounded-xl border border-[#fddf49]/30 bg-[#1e2020] p-4 shadow-[0_12px_50px_#00000020] sm:p-5">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fddf49]/20"><span className="h-4 w-4 rounded-full bg-[#fddf49] shadow-[0_0_14px_#fddf4940]" /></span><div><h1 className="text-sm font-semibold tracking-wide text-[#f2f2f2]">DR. EVELYN VANCE <span className="ml-2 text-[11px] font-normal text-[#fddf49]">/ AI CODE ARBITER</span></h1><p className="mt-1 text-[11px] text-[#a6a6a1]">{activeBattle.problem?.title || "1v1 Duel"} / {done ? "Interview complete" : Number.isInteger(step) ? `Question ${step + 1} of ${total ?? "—"}` : "Preparing interview"}</p></div></div><span className="rounded-md border border-[#fddf49]/20 bg-[#fddf49]/10 px-3 py-1.5 text-[10px] font-medium text-[#fddf49]">{finalizing ? "SCORING" : done ? "WAITING FOR OPPONENT" : "AI INTERVIEW"}</span></header>
      <p className="mb-4 flex items-center gap-2 text-[11px] text-[#94bc9d]"><CheckCircle2 size={13} />Your solution / {testsPassed ?? "—"} of {testsTotal ?? "—"} tests passed</p>
      <section className="mb-4 rounded-lg border border-[#fddf49]/20 bg-[#151919] p-4" aria-label="Your submitted code"><h2 className="text-xs font-semibold text-[#fddf49]">Your submitted code · read only</h2><p className="mt-1 text-[11px] text-[#a7b3ba]">Refer to your solution while answering. It stays visible while scoring.</p><pre tabIndex={0} className="mt-3 max-h-80 overflow-auto whitespace-pre font-mono text-xs leading-6 text-[#c1cbd1]">{finalCode === null ? "Loading your submitted code…" : finalCode || "No code saved."}</pre></section>
      {(done || finalizing) && <div role="status" className="mb-4 rounded-lg border border-[#fddf49]/30 bg-[#151919] p-4 text-sm text-[#fddf49]"><p>{finalizing ? "Scoring both interviews…" : `Interview complete. The verdict comes after ${opponent} finishes.`}</p><p className="mt-2 text-xs text-[#b8c0c5]">{opponent}: {phaseLabel}</p></div>}
      <div className="relative aspect-[16/8] min-h-[220px] overflow-hidden rounded-lg border border-[#fddf49]/30 bg-[#0b1219] sm:min-h-[300px]">
        {!imageFailed ? <img src={portrait} alt="Fictional AI interviewer in a coding arena" onError={() => setImageFailed(true)} className="h-full w-full object-cover object-top" /> : <div className="flex h-full items-center justify-center text-[#7ba1b8]"><UserRound size={90} strokeWidth={1} /></div>}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080c10]/90 via-transparent to-[#080c10]/20" />
        <span className="absolute left-3 top-3 flex items-center gap-2 rounded border border-white/15 bg-[#080c10]/90 px-3 py-1.5 text-[10px] text-[#dedede]"><span className="h-1.5 w-1.5 rounded-full bg-[#d47d86]" />GUIDED INTERVIEW</span>
        <button disabled={done || finalizing || thinking || sending || !voiceEnabled} onClick={speaking ? stopQuestion : readQuestion} className="absolute right-3 top-3 flex items-center gap-2 rounded border border-[#fddf49]/25 bg-[#080c10]/90 px-3 py-1.5 text-[10px] font-medium text-[#fddf49] disabled:opacity-50">{speaking ? <CircleStop size={13} /> : <Volume2 size={13} />}{!voiceEnabled ? "VOICE OFF" : speaking ? "STOP AUDIO" : "PLAY QUESTION"}</button>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-md border border-[#fddf49]/30 bg-[#242727]/95 px-4 py-3"><div className="flex items-center gap-3"><AudioLines size={20} className="text-[#fddf49]" /><div><p className="text-[11px] font-semibold text-white">{speaking ? "READING YOUR QUESTION" : "YOUR CODE. YOUR EXPLANATION."}</p><p className="mt-0.5 text-[10px] text-[#aaa9a0]">{speaking ? "Browser voice playback" : "Listen to the question, then explain your approach."}</p></div></div><div aria-hidden="true" className="flex h-6 items-center gap-1">{[10, 20, 14, 24, 12, 18].map((height, index) => <span key={index} className={`w-1 rounded-full bg-[#fddf49]/60 ${speaking ? "animate-pulse" : ""}`} style={{ height: speaking ? height : 6, animationDelay: `${index * 120}ms` }} />)}</div></div>
      </div>
      <button type="button" onClick={() => { if (voiceEnabled) stopQuestion(); setVoiceEnabled((value) => !value); }} disabled={!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)} className="mt-3 flex items-center gap-2 text-xs text-[#fddf49] disabled:opacity-50">{voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}{voiceEnabled ? "Turn voice off" : "Turn voice on"}</button>
      <div className="mt-4 rounded-lg border border-[#fddf49]/70 border-l-4 bg-[#0c1010] p-5"><div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-[#efefef]"><MessageSquare size={15} className="text-[#fddf49]" />DR. EVELYN VANCE / {finalizing ? "SCORING" : done ? "INTERVIEW COMPLETE" : thinking ? "THINKING" : "INTERVIEW QUESTION"}</div><h2 className="text-sm font-medium leading-7 text-[#e6e7e5]">{finalizing ? "Scoring both interviews…" : done ? `Interview complete. The verdict comes after ${opponent} finishes.` : thinking ? "Interviewer is thinking…" : <><span className="sr-only">{question?.text}</span><span aria-hidden="true">{caption}{speaking && <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-[#fddf49] align-middle" />}</span></>}</h2></div>
      {!done && !finalizing && !thinking && question && <><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4"><div className="flex items-center gap-3"><button onClick={toggleMic} disabled={remaining === 0 || readingRef.current || sending || micUnavailable} className="flex items-center gap-2 rounded-md border border-white/10 bg-[#333739] px-4 py-2 text-xs text-[#e4e7ea] disabled:opacity-40">{listening ? <Mic size={15} className="text-[#54c9a6]" /> : <MicOff size={15} />}{listening ? "Mute mic" : "Enable mic"}<span className="hidden text-[10px] text-[#9ca3af] sm:inline">[Spacebar]</span></button><span className={`text-[11px] ${listening ? "text-[#54c9a6]" : "text-[#92999f]"}`}>{listening ? "Listening" : "Mic off"}</span></div><span className="flex items-center gap-2 rounded-md border border-white/10 bg-[#262a2c] px-3 py-2 text-xs text-[#e4e7ea]"><Timer size={14} className="text-[#fddf49]" />{readingRef.current && !answerEndRef.current ? "Reading question" : "Remaining"}: <b className="text-[#fddf49]">{readingRef.current && !answerEndRef.current ? "…" : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`}</b></span></div>{remaining === 0 && <p className="mt-3 text-xs text-[#d7b578]">Time is up. Sending your answer or waiting for the next question…</p>}<form onSubmit={send} className="mt-4"><label htmlFor="interview-answer" className="mb-2 block text-xs text-[#a7b3ba]">Your answer</label><textarea id="interview-answer" value={answer} maxLength={2000} readOnly={readingRef.current || sending || remaining === 0} onChange={(event) => { stopMic(); inputModeRef.current = "typed"; saveAnswer(event.target.value); }} onPaste={(event) => { event.preventDefault(); setNotice("Paste is disabled. Please speak or type your answer."); }} onDrop={(event) => { event.preventDefault(); setNotice("Drop is disabled. Please speak or type your answer."); }} onDragOver={(event) => event.preventDefault()} placeholder="Speak using the microphone or type your explanation..." className="min-h-28 w-full rounded-lg border border-white/10 bg-[#0d1112] p-3 text-sm leading-6 text-[#e4eaf5] outline-none focus:border-[#fddf49]/50" /><p className="mt-2 text-xs text-[#a7b3ba]">Skipped questions earn zero and lower your overall score.</p><div className="mt-3 flex justify-end gap-3"><button type="button" disabled={sending || remaining === 0} onClick={() => send(null, false, true)} className="rounded-md border border-white/20 px-4 py-2 text-xs text-[#e4e7ea] disabled:opacity-40">Skip question</button><button disabled={readingRef.current || sending || remaining === 0} className="flex items-center gap-2 rounded-md bg-[#fddf49] px-4 py-2.5 text-xs font-semibold text-[#24200b] disabled:opacity-40"><Send size={13} />{sending ? "Sending…" : step === total - 1 ? "Finish interview" : "Next question"}</button></div></form></>}
      {(notice || micUnavailable) && <p role="status" className="mt-3 text-xs leading-5 text-[#d7b578]">{notice || "Voice input is unavailable in this browser. Please type your answer."}</p>}
      {answerError && <div role="alert" className="mt-3 text-xs text-[#f2a5a5]"><p>{answerError}</p><button type="button" onClick={() => joinInterview().then(() => setAnswerError("")).catch((error) => setAnswerError(error.message))} className="mt-2 underline text-[#fddf49]">Resume interview</button></div>}
      {history.length > 0 && <details open={done} className="mt-5 border-t border-white/10 pt-4"><summary className="cursor-pointer text-xs text-[#a7b3ba]">Review your answers ({history.length})</summary>{history.map((entry) => <article key={entry.index} className="mt-3 rounded-md bg-[#161a1b] p-4"><h3 className="text-xs font-medium text-[#fddf49]">Question {entry.index + 1}</h3><p className="mt-2 text-sm text-[#e4e7ea]">{entry.text}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#b8c0c5]">{entry.status === "skipped" ? "Skipped · 0 points" : entry.answer || "No answer provided."}</p></article>)}</details>}
      <p className="mt-4 text-[10px] leading-5 text-[#7c868e]">Answers are transcribed in your browser and sent to an AI service for scoring.</p>
    </section>
  </div>;
}
