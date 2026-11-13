import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AudioLines, CheckCircle2, CircleStop, MessageSquare, Mic, MicOff, Send, Timer, UserRound, Volume2 } from "lucide-react";

const questions = [
  "You used a hash map to find the complement. Why did you choose that approach instead of sorting the array and using two pointers? How would sorting affect the original indices?",
  "What are the time and space complexities of your solution? Explain how hash-map lookups affect the running time.",
  "How does your solution handle duplicate values, such as nums = [3, 3] and target = 6? Why must the lookup happen before inserting the current number?",
];
const portrait = "https://lh3.googleusercontent.com/aida-public/AB6AXuAboQvrM1yaEPgCCrJLfF6T6BkHamG_6Nr_IdwnzFh7zvgxr7tk9EKeexT5T8_o3esB5MCwpuSfpmD5PCDEFdH-VivNrqSbosz5l38Ae13sNZFMqToWZTfNBFafusfE3JZrLDdcHWCP_YsDoEOeADRPsmbXkkJA1nbaTDG3bbKw5Urr94DzDayLxI3IdK6kCMLs_AKr-bJNBKBBAoKlf1am3BaaMKD8pBhR2OwV1QN0";

export default function AIInterview() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const submission = state?.submission;
  const draft = state?.interviewDraft;
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [remaining, setRemaining] = useState(90);
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState(questions[0]);
  const speechRef = useRef(null);
  const captionTimerRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const recognitionRef = useRef(null);
  const done = step >= questions.length;

  useEffect(() => () => {
    speechRef.current = null;
    window.clearInterval(captionTimerRef.current);
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();
  }, []);
  useEffect(() => {
    if (done) return;
    setRemaining(90);
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, done]);
  useEffect(() => {
    if (remaining === 0 && listening) recognitionRef.current?.stop();
  }, [remaining, listening]);

  function stopQuestion() {
    speechRef.current = null;
    window.clearInterval(captionTimerRef.current);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setCaption(questions[step] || "");
  }
  function readQuestion() {
    const text = questions[step];
    if (!text) return;
    if (!("speechSynthesis" in window)) { setCaption(text); setNotice("Audio playback is unavailable. Read the question below."); return; }
    speechRef.current = null;
    window.clearInterval(captionTimerRef.current);
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speechRef.current = speech;
    speech.rate = 0.95;
    let hasWordBoundaries = false;
    let fallbackWords = 0;
    const words = text.split(/\s+/);
    speech.onstart = () => {
      if (speechRef.current !== speech) return;
      setNotice(""); setSpeaking(true); setCaption("");
      // Fallback for voices that do not emit word-boundary events.
      captionTimerRef.current = window.setInterval(() => {
        if (hasWordBoundaries || speechRef.current !== speech) return;
        fallbackWords = Math.min(words.length, fallbackWords + 1);
        setCaption(words.slice(0, fallbackWords).join(" "));
      }, 390);
    };
    speech.onboundary = (event) => {
      if (speechRef.current !== speech || event.name !== "word") return;
      hasWordBoundaries = true;
      const start = event.charIndex;
      const nextSpace = text.indexOf(" ", start);
      setCaption(text.slice(0, nextSpace === -1 ? text.length : nextSpace));
    };
    const finish = () => {
      if (speechRef.current !== speech) return;
      window.clearInterval(captionTimerRef.current);
      setSpeaking(false); setCaption(text);
    };
    speech.onend = finish;
    speech.onerror = () => { finish(); setNotice("Tap Play question to enable audio if your browser blocked playback."); };
    window.speechSynthesis.speak(speech);
  }
  useEffect(() => {
    if (done) return;
    setCaption(questions[step]);
    const timer = window.setTimeout(readQuestion, 200);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(captionTimerRef.current);
      speechRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, [step, done]);
  function toggleMic() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setNotice("Voice input is unavailable in this browser. You can type your answer below."); return; }
    stopQuestion();
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => { setListening(true); setNotice(""); };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setNotice("Microphone input could not start. Check microphone permission or type your answer."); };
    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) text += event.results[i][0].transcript + " ";
      if (text.trim()) setAnswer((previous) => `${previous}${previous ? " " : ""}${text.trim()}`);
    };
    try { recognition.start(); } catch { setNotice("Microphone is unavailable. You can type your answer."); }
  }
  useEffect(() => {
    const keydown = (event) => {
      if (done || event.code !== "Space" || event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|BUTTON|SELECT|A)$/.test(event.target.tagName)) return;
      event.preventDefault(); toggleMic();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [done, listening, step]);
  function send(event) {
    event.preventDefault();
    if (!answer.trim()) return;
    recognitionRef.current?.abort(); stopQuestion();
    const completedAnswers = [...answers, answer.trim()];
    setAnswers(completedAnswers);
    if (step === questions.length - 1) {
      navigate("/match-report", { state: { answers: completedAnswers, submission, interviewDraft: draft } });
      return;
    }
    setAnswer(""); setStep((previous) => previous + 1);
  }

  return <div className="min-h-[calc(100vh-64px)] bg-[#111414] px-4 py-6 sm:px-6 sm:py-8">
    <section className="mx-auto max-w-[1000px] rounded-xl border border-[#fddf49]/30 bg-[#1e2020] p-4 shadow-[0_12px_50px_#00000020] sm:p-5">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fddf49]/20"><span className="h-4 w-4 rounded-full bg-[#fddf49] shadow-[0_0_14px_#fddf4940]" /></span><div><h1 className="text-sm font-semibold tracking-wide text-[#f2f2f2]">DR. EVELYN VANCE <span className="ml-2 text-[11px] font-normal text-[#fddf49]">/ AI CODE ARBITER</span></h1><p className="mt-1 text-[11px] text-[#a6a6a1]">Guided oral defense / Two Sum / Question {Math.min(step + 1, 3)} of 3</p></div></div><span className="rounded-md border border-[#fddf49]/20 bg-[#fddf49]/10 px-3 py-1.5 text-[10px] font-medium text-[#fddf49]">INTERVIEW PREVIEW</span></header>
      {submission && <p className="mb-4 flex items-center gap-2 text-[11px] text-[#94bc9d]"><CheckCircle2 size={13} />Submission accepted / {submission.passedCount} of {submission.totalCount} tests passed</p>}
      {draft && <details className="mb-4 rounded-lg border border-white/10 bg-[#151919] p-3"><summary className="cursor-pointer text-xs text-[#a7b3ba]">Your submitted solution / {draft.language}</summary><pre className="mt-3 max-h-64 overflow-auto font-mono text-xs leading-6 text-[#c1cbd1]">{draft.code}</pre></details>}
      <div className="relative aspect-[16/8] min-h-[220px] overflow-hidden rounded-lg border border-[#fddf49]/30 bg-[#0b1219] sm:min-h-[300px]">
        {!imageFailed ? <img src={portrait} alt="Fictional AI interviewer in a coding arena" onError={() => setImageFailed(true)} className="h-full w-full object-cover object-top" /> : <div className="flex h-full items-center justify-center text-[#7ba1b8]"><UserRound size={90} strokeWidth={1} /></div>}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080c10]/90 via-transparent to-[#080c10]/20" />
        <span className="absolute left-3 top-3 flex items-center gap-2 rounded border border-white/15 bg-[#080c10]/90 px-3 py-1.5 text-[10px] text-[#dedede]"><span className="h-1.5 w-1.5 rounded-full bg-[#d47d86]" />GUIDED INTERVIEW</span>
        <button disabled={done} onClick={speaking ? stopQuestion : readQuestion} className="absolute right-3 top-3 flex items-center gap-2 rounded border border-[#fddf49]/25 bg-[#080c10]/90 px-3 py-1.5 text-[10px] font-medium text-[#fddf49] disabled:opacity-50">{speaking ? <CircleStop size={13} /> : <Volume2 size={13} />}{speaking ? "STOP AUDIO" : "PLAY QUESTION"}</button>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-md border border-[#fddf49]/30 bg-[#242727]/95 px-4 py-3"><div className="flex items-center gap-3"><AudioLines size={20} className="text-[#fddf49]" /><div><p className="text-[11px] font-semibold text-white">{speaking ? "READING YOUR QUESTION" : "YOUR CODE. YOUR EXPLANATION."}</p><p className="mt-0.5 text-[10px] text-[#aaa9a0]">{speaking ? "Browser voice playback" : "Listen to the question, then explain your approach."}</p></div></div><div aria-hidden="true" className="flex h-6 items-center gap-1">{[10, 20, 14, 24, 12, 18].map((height, index) => <span key={index} className={`w-1 rounded-full bg-[#fddf49]/60 ${speaking ? "animate-pulse" : ""}`} style={{ height: speaking ? height : 6, animationDelay: `${index * 120}ms` }} />)}</div></div>
      </div>
      <div className="mt-4 rounded-lg border border-[#fddf49]/70 border-l-4 bg-[#0c1010] p-5"><div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-[#efefef]"><MessageSquare size={15} className="text-[#fddf49]" />DR. EVELYN VANCE / {done ? "INTERVIEW COMPLETE" : "INTERVIEW QUESTION"}</div><h2 className="text-sm font-medium leading-7 text-[#e6e7e5]">{done ? "You have completed all three questions. Review your explanations below." : <><span className="sr-only">{questions[step]}</span><span aria-hidden="true">{caption}{speaking && <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-[#fddf49] align-middle" />}</span></>}</h2></div>
      {!done && <><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4"><div className="flex items-center gap-3"><button onClick={toggleMic} disabled={remaining === 0} className="flex items-center gap-2 rounded-md border border-white/10 bg-[#333739] px-4 py-2 text-xs text-[#e4e7ea] disabled:opacity-40">{listening ? <Mic size={15} className="text-[#54c9a6]" /> : <MicOff size={15} />}{listening ? "Mute mic" : "Enable mic"}<span className="hidden text-[10px] text-[#9ca3af] sm:inline">[Spacebar]</span></button><span className={`text-[11px] ${listening ? "text-[#54c9a6]" : "text-[#92999f]"}`}>{listening ? "Listening" : "Mic off"}</span></div><span className="flex items-center gap-2 rounded-md border border-white/10 bg-[#262a2c] px-3 py-2 text-xs text-[#e4e7ea]"><Timer size={14} className="text-[#fddf49]" />Remaining: <b className="text-[#fddf49]">{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</b></span></div>{remaining === 0 && <p className="mt-3 text-xs text-[#d7b578]">Time is up. You can finish typing and continue when ready.</p>}{notice && <p role="status" className="mt-3 text-xs leading-5 text-[#d7b578]">{notice}</p>}<form onSubmit={send} className="mt-4"><label htmlFor="interview-answer" className="mb-2 block text-xs text-[#a7b3ba]">Your answer</label><textarea id="interview-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Speak using the microphone or type your explanation..." className="min-h-28 w-full rounded-lg border border-white/10 bg-[#0d1112] p-3 text-sm leading-6 text-[#e4eaf5] outline-none focus:border-[#fddf49]/50" /><div className="mt-3 flex justify-end"><button disabled={!answer.trim()} className="flex items-center gap-2 rounded-md bg-[#fddf49] px-4 py-2.5 text-xs font-semibold text-[#24200b] disabled:opacity-40"><Send size={13} />{step === 2 ? "Finish interview" : "Next question"}</button></div></form></>}
      {answers.length > 0 && <details open={done} className="mt-5 border-t border-white/10 pt-4"><summary className="cursor-pointer text-xs text-[#a7b3ba]">Review your answers ({answers.length})</summary>{answers.map((text, index) => <article key={index} className="mt-3 rounded-md bg-[#161a1b] p-4"><h3 className="text-xs font-medium text-[#fddf49]">Question {index + 1}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#b8c0c5]">{text}</p></article>)}</details>}
      {done && <Link to="/dashboard" className="mt-5 inline-block rounded-md bg-[#fddf49] px-4 py-2.5 text-xs font-semibold text-[#24200b]">Back to Command Deck</Link>}
      <p className="mt-4 text-[10px] leading-5 text-[#7c868e]">Fictional interviewer. Guided preview with browser speech tools; AI assessment and answer storage are not connected.</p>
    </section>
  </div>;
}
