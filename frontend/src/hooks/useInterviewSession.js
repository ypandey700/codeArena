import { useEffect, useRef, useState } from "react";

export const PREPARATION_SECONDS = 5;
const timestamp = (value) => { if (value == null || value === "") return Infinity; const time = typeof value === "number" ? value : new Date(value).getTime(); return Number.isFinite(time) ? time : Infinity; };
const RecognitionAPI = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const canSpeak = () => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const readSaved = (key) => { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } };
const store = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {} };
const joinText = (...parts) => parts.map((part) => part.trim()).filter(Boolean).join(" ").slice(0, 2000);

export default function useInterviewSession({ battleId, userId, question, interviewDeadlineAt, timeOffset = 0, done, finalizing, thinking, answerInterview, joinInterview }) {
  const key = question && battleId ? `${battleId}:${userId}:${question.index}` : "";
  const setupKey = battleId ? `interview-setup:${battleId}:${userId}` : "";
  const [readyFor, setReadyFor] = useState(() => readSaved(setupKey)?.ready ? setupKey : "");
  const ready = Boolean(setupKey && readyFor === setupKey);
  const [phase, setPhase] = useState("idle");
  const [answer, setAnswer] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [preparation, setPreparation] = useState(PREPARATION_SECONDS);
  const [capture, setCapture] = useState(RecognitionAPI() ? "idle" : "unavailable");
  const [permission, setPermission] = useState("prompt");
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [mode, setMode] = useState(() => RecognitionAPI() && readSaved(setupKey)?.mode !== "typed" ? "voice" : "typed");
  const [autoRecord, setAutoRecord] = useState(() => readSaved(setupKey)?.autoRecord !== false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => canSpeak() && readSaved(setupKey)?.voiceEnabled !== false);
  const [microphoneName, setMicrophoneName] = useState("");
  const [audioTest, setAudioTest] = useState("idle");
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const live = useRef({});
  const phaseRef = useRef("idle");
  const answerRef = useRef("");
  const inputModeRef = useRef("typed");
  const flow = useRef({ prepareEnd: 0, answerEnd: 0 });
  const prepareMonoEnd = useRef(0);
  const recognition = useRef(null);
  const speech = useRef(null);
  const wanted = useRef(false);
  const manualPause = useRef(false);
  const permissionRequest = useRef(null);
  const restartCount = useRef(0);
  const timers = useRef({});
  const flushing = useRef(null);
  const inFlight = useRef(null);
  const autoSubmitted = useRef(false);
  const startRef = useRef(null);
  const submitRef = useRef(null);
  live.current = { key, setupKey, ready, question, interviewDeadlineAt, timeOffset, done, finalizing, thinking, mode, autoRecord, voiceEnabled, answerInterview, joinInterview };

  const now = () => Date.now() + live.current.timeOffset;
  const limit = () => Math.min(timestamp(live.current.question?.deadlineAt), timestamp(live.current.interviewDeadlineAt)) - 1000;
  const active = (questionKey = live.current.key) => mounted.current && live.current.ready && questionKey && live.current.key === questionKey && !live.current.done && !live.current.finalizing && !live.current.thinking;
  const transition = (next) => { phaseRef.current = next; if (mounted.current) setPhase(next); };
  const clear = (name) => { clearTimeout(timers.current[name]); delete timers.current[name]; };
  const clearTimers = () => { Object.values(timers.current).forEach(clearTimeout); timers.current = {}; };
  const budget = () => {
    const interval = timestamp(live.current.question?.deadlineAt) - timestamp(live.current.question?.askedAt);
    const configured = Number(import.meta.env.VITE_INTERVIEW_QUESTION_SECONDS);
    const allowance = Number(import.meta.env.VITE_INTERVIEW_READ_ALLOWANCE_SECONDS ?? 15);
    const derived = interval > allowance * 1000 ? interval - allowance * 1000 : interval;
    return configured > 0 ? configured * 1000 : Number.isFinite(derived) && derived > 0 ? derived : 90000;
  };
  const saveFlow = () => { if (live.current.key) store(`interview-flow:${live.current.key}`, flow.current); };
  const saveAnswer = (text, inputMode = inputModeRef.current) => {
    answerRef.current = text.slice(0, 2000);
    inputModeRef.current = inputMode;
    if (mounted.current) setAnswer(answerRef.current);
    if (live.current.key) store(`interview-answer:${live.current.key}`, { text: answerRef.current, inputMode });
  };

  function stopSpeech() {
    clear("playbackStart"); clear("playbackEnd"); clear("speakerTest");
    const current = speech.current;
    speech.current = null;
    if (current) { current.onstart = null; current.onend = null; current.onerror = null; }
    window.speechSynthesis?.cancel();
    if (mounted.current) { setSpeaking(false); setAudioTest((current) => current === "playing" ? "idle" : current); }
  }

  function resolveFlush() {
    const current = flushing.current;
    flushing.current = null;
    if (current) { clearTimeout(current.timer); current.resolve(); }
  }

  function stopCapture({ flush = false, status = "paused" } = {}) {
    clear("restart"); clear("captureStart");
    const current = recognition.current;
    if (mounted.current) setCapture(RecognitionAPI() ? flush && current ? "stopping" : status : "unavailable");
    if (!current) { resolveFlush(); return Promise.resolve(); }
    if (flush) {
      if (flushing.current) return flushing.current.promise;
      let resolve;
      const promise = new Promise((finish) => { resolve = finish; });
      const timer = setTimeout(() => {
        if (recognition.current === current) {
          recognition.current = null;
          current.onstart = null; current.onend = null; current.onresult = null; current.onerror = null;
          try { current.abort(); } catch {}
          if (mounted.current) setCapture(RecognitionAPI() ? status : "unavailable");
        }
        resolveFlush();
      }, 400);
      flushing.current = { promise, resolve, timer };
      try { current.stop(); } catch { current.onend?.(); }
      return promise;
    }
    recognition.current = null;
    current.onstart = null; current.onend = null; current.onresult = null; current.onerror = null;
    try { current.abort(); } catch {}
    resolveFlush();
    return Promise.resolve();
  }

  function startCapture() {
    const current = live.current;
    if (!active(current.key) || phaseRef.current !== "answering" || current.mode !== "voice" || !wanted.current || recognition.current || now() >= Math.min(flow.current.answerEnd || Infinity, limit())) return;
    if (document.visibilityState !== "visible") { wanted.current = false; manualPause.current = true; setCapture("paused"); setNotice("Recording is paused while this tab is hidden. Resume when you’re ready."); return; }
    if (permissionRequest.current) { setCapture("permission"); return; }
    const API = RecognitionAPI();
    if (!API) { setCapture("unavailable"); setMode("typed"); setNotice("Voice input is unavailable in this browser. Type your answer instead."); return; }
    const questionKey = current.key;
    const instance = new API();
    const base = answerRef.current;
    recognition.current = instance;
    instance.lang = "en-US";
    instance.continuous = true;
    instance.interimResults = true;
    setCapture("starting");
    const valid = () => recognition.current === instance && active(questionKey);
    instance.onstart = () => {
      if (!valid() || !wanted.current || phaseRef.current !== "answering") { if (recognition.current === instance) stopCapture(); return; }
      clear("captureStart"); setCapture("listening"); setPermission("granted"); setNotice("");
    };
    instance.onresult = (event) => {
      if (!valid()) return;
      const parts = [];
      for (let index = 0; index < event.results.length; index++) parts.push(event.results[index][0]?.transcript || "");
      if (parts.some((part) => part.trim())) { restartCount.current = 0; saveAnswer(joinText(base, ...parts), "voice"); }
    };
    instance.onerror = (event) => {
      if (!valid()) return;
      if (event.error === "no-speech") return;
      wanted.current = false;
      if (["not-allowed", "service-not-allowed"].includes(event.error)) {
        setPermission("denied"); stopCapture({ status: "blocked" });
        setNotice("Microphone access is blocked. Allow it in your browser and retry, or type your answer.");
      } else {
        stopCapture({ status: "error" });
        setNotice(event.error === "audio-capture" ? "No microphone is available. Check your device or type your answer." : "Voice input was interrupted. Resume recording or continue by typing.");
      }
    };
    instance.onend = () => {
      if (recognition.current !== instance) return;
      clear("captureStart"); recognition.current = null; resolveFlush();
      if (!active(questionKey) || !wanted.current || phaseRef.current !== "answering") { if (mounted.current) setCapture("paused"); return; }
      if (++restartCount.current > 3) { wanted.current = false; setCapture("paused"); setNotice("Voice input stopped. Resume recording when you’re ready, or type your answer."); return; }
      setCapture("starting");
      timers.current.restart = setTimeout(() => { if (active(questionKey) && wanted.current) startRef.current?.(); }, 300);
    };
    timers.current.captureStart = setTimeout(() => {
      if (recognition.current !== instance) return;
      wanted.current = false; stopCapture({ status: "blocked" });
      setNotice("The microphone hasn’t started. Allow microphone access, then choose Resume recording, or type your answer.");
    }, 10000);
    try { instance.start(); }
    catch { wanted.current = false; stopCapture({ status: "error" }); setNotice("Microphone input couldn’t start. Choose Resume recording or type your answer."); }
  }
  startRef.current = startCapture;

  function beginAnswer() {
    if (!active() || phaseRef.current !== "preparing") return;
    transition("answering");
    setPreparation(0);
    wanted.current = live.current.autoRecord && live.current.mode === "voice" && !manualPause.current;
    if (wanted.current) startRef.current?.();
    else setCapture(RecognitionAPI() ? "paused" : "unavailable");
  }

  function beginPreparation() {
    if (!active() || phaseRef.current !== "reading") return;
    stopSpeech();
    flow.current.prepareEnd = now() + PREPARATION_SECONDS * 1000;
    flow.current.answerEnd = Math.min(flow.current.answerEnd || Infinity, flow.current.prepareEnd + budget(), limit());
    prepareMonoEnd.current = performance.now() + PREPARATION_SECONDS * 1000;
    saveFlow();
    setPreparation(PREPARATION_SECONDS);
    transition("preparing");
  }

  function readQuestion() {
    if (!active()) return;
    wanted.current = false;
    stopCapture({ status: "idle" }); stopSpeech();
    const current = live.current;
    const questionKey = current.key;
    transition("reading");
    if (!current.voiceEnabled || !canSpeak()) { beginPreparation(); return; }
    const utterance = new window.SpeechSynthesisUtterance(current.question.text);
    speech.current = utterance;
    utterance.lang = "en-US"; utterance.rate = .95;
    const finish = () => { if (speech.current === utterance && active(questionKey) && phaseRef.current === "reading") beginPreparation(); };
    utterance.onstart = () => { if (speech.current === utterance && active(questionKey)) { clear("playbackStart"); setSpeaking(true); } };
    utterance.onend = finish;
    utterance.onerror = () => {
      if (speech.current !== utterance || !active(questionKey)) return;
      setNotice("Question audio is unavailable. Read the question on screen; your five-second preparation starts now."); finish();
    };
    timers.current.playbackStart = setTimeout(() => { if (speech.current === utterance && active(questionKey)) { setNotice("Question audio didn’t start. Continue with the question on screen."); finish(); } }, 2500);
    timers.current.playbackEnd = setTimeout(finish, Math.max(7000, current.question.text.split(/\s+/).length * 700 + 3000));
    try { window.speechSynthesis.speak(utterance); }
    catch { if (active(questionKey)) { setNotice("Question audio is unavailable. Continue with the question on screen."); finish(); } }
  }

  function pauseRecording() {
    manualPause.current = true; wanted.current = false;
    stopCapture({ flush: true });
  }
  function resumeRecording() {
    if (!active() || phaseRef.current !== "answering") return;
    manualPause.current = false; wanted.current = true; restartCount.current = 0;
    setNotice(""); startRef.current?.();
  }
  function chooseMode(next) {
    live.current.mode = next; setMode(next);
    if (next === "typed") { wanted.current = false; manualPause.current = true; stopCapture(); }
    else { manualPause.current = false; if (phaseRef.current === "answering") { wanted.current = true; startRef.current?.(); } }
  }
  function toggleAutoRecord() {
    const next = !live.current.autoRecord;
    live.current.autoRecord = next; setAutoRecord(next);
    if (!next) pauseRecording();
    else { manualPause.current = false; if (phaseRef.current === "answering" && live.current.mode === "voice") resumeRecording(); }
  }
  function toggleVoice() {
    const next = !live.current.voiceEnabled;
    live.current.voiceEnabled = next; setVoiceEnabled(next);
    if (!next && phaseRef.current === "reading") beginPreparation();
  }
  function replayQuestion() {
    if (!active() || inFlight.current || phaseRef.current === "preparing") return;
    readQuestion();
  }

  function testSpeaker() {
    if (!mounted.current || live.current.ready || !canSpeak()) return;
    stopSpeech();
    setAudioTest("playing");
    const utterance = new window.SpeechSynthesisUtterance("Welcome to your Code Arena interview. After each question, you have five seconds to prepare.");
    const currentSetup = live.current.setupKey;
    speech.current = utterance;
    utterance.lang = "en-US";
    const finish = (status) => {
      if (speech.current !== utterance || !mounted.current || live.current.setupKey !== currentSetup) return;
      setAudioTest(status);
      stopSpeech();
    };
    utterance.onend = () => finish("played");
    utterance.onerror = () => finish("error");
    timers.current.speakerTest = setTimeout(() => finish("error"), 10000);
    try { window.speechSynthesis.speak(utterance); } catch { finish("error"); }
  }

  function completeSetup({ typed = false } = {}) {
    if (!mounted.current || !live.current.setupKey || live.current.done || live.current.finalizing) return;
    if (!typed && live.current.mode === "voice" && (permission !== "granted" || !microphoneName || permissionRequest.current)) return;
    stopSpeech();
    if (typed) chooseMode("typed");
    live.current.ready = true;
    store(live.current.setupKey, { ready: true, mode: live.current.mode, autoRecord: live.current.autoRecord, voiceEnabled: live.current.voiceEnabled });
    setNotice(""); setError("");
    setReadyFor(live.current.setupKey);
  }

  async function enableMicrophone() {
    if (permissionRequest.current || !RecognitionAPI()) return;
    if (!navigator.mediaDevices?.getUserMedia) { setNotice("Microphone access is unavailable here. Use a supported browser on HTTPS or localhost, or type your answer."); return; }
    manualPause.current = false;
    setPermissionBusy(true);
    const currentSetup = live.current.setupKey;
    const request = navigator.mediaDevices.getUserMedia({ audio: true });
    permissionRequest.current = request;
    try {
      const stream = await request;
      const deviceName = stream.getAudioTracks()[0]?.label || "Default microphone";
      stream.getTracks().forEach((track) => track.stop());
      if (!mounted.current || live.current.setupKey !== currentSetup) return;
      setPermission("granted"); setMicrophoneName(deviceName); setNotice("");
      if (active() && phaseRef.current === "answering" && live.current.mode === "voice" && !manualPause.current) { wanted.current = true; permissionRequest.current = null; startRef.current?.(); }
    } catch (failure) {
      if (mounted.current && live.current.setupKey === currentSetup) {
        const denied = ["NotAllowedError", "SecurityError"].includes(failure.name);
        setPermission(denied ? "denied" : "prompt"); setCapture("blocked");
        setNotice(failure.name === "NotFoundError" ? "No microphone was found. Connect a microphone and retry, or continue by typing." : failure.name === "NotReadableError" ? "Your microphone could not be opened. Close other apps using it and retry, or continue by typing." : "Microphone access wasn’t granted. Allow it in your browser and retry, or continue by typing.");
      }
    } finally { if (permissionRequest.current === request) permissionRequest.current = null; if (mounted.current) setPermissionBusy(false); }
  }

  async function submit({ skip = false, automatic = false } = {}) {
    const current = live.current;
    if (!active(current.key) || inFlight.current || ["sending", "waiting"].includes(phaseRef.current) || (!skip && !automatic && phaseRef.current !== "answering")) return;
    const questionKey = current.key;
    inFlight.current = questionKey;
    wanted.current = false;
    stopSpeech(); clear("restart");
    transition("sending"); setError("");
    try {
      await stopCapture({ flush: !skip });
      if (!active(questionKey)) return;
      await live.current.answerInterview({ questionIndex: current.question.index, text: skip ? "" : answerRef.current, inputMode: inputModeRef.current, skip });
      if (active(questionKey)) transition("waiting");
    } catch (failure) {
      if (active(questionKey)) { setError(failure.message || "Your answer couldn’t be sent. Try again."); transition("answering"); setCapture(RecognitionAPI() ? "paused" : "unavailable"); }
      live.current.joinInterview().catch(() => {});
    } finally { if (inFlight.current === questionKey) inFlight.current = null; }
  }
  submitRef.current = submit;

  useEffect(() => {
    mounted.current = true;
    const leave = () => { wanted.current = false; manualPause.current = true; stopSpeech(); stopCapture(); clearTimers(); };
    window.addEventListener("pagehide", leave);
    return () => { mounted.current = false; leave(); window.removeEventListener("pagehide", leave); };
  }, []);

  useEffect(() => {
    const saved = readSaved(setupKey);
    setReadyFor(saved?.ready ? setupKey : "");
    setMode(RecognitionAPI() && saved?.mode !== "typed" ? "voice" : "typed");
    setAutoRecord(saved?.autoRecord !== false);
    setVoiceEnabled(canSpeak() && saved?.voiceEnabled !== false);
    setMicrophoneName(""); setAudioTest("idle");
  }, [setupKey]);

  useEffect(() => {
    if (ready) store(setupKey, { ready: true, mode, autoRecord, voiceEnabled });
  }, [setupKey, ready, mode, autoRecord, voiceEnabled]);

  useEffect(() => {
    let status;
    let cancelled = false;
    const changed = () => {
      if (cancelled || !mounted.current) return;
      setPermission(status.state);
      if (status.state === "denied") { wanted.current = false; stopCapture({ status: "blocked" }); }
    };
    navigator.permissions?.query({ name: "microphone" }).then((result) => { if (cancelled) return; status = result; changed(); status.addEventListener("change", changed); }).catch(() => {});
    return () => { cancelled = true; status?.removeEventListener("change", changed); };
  }, []);

  useEffect(() => {
    clearTimers(); wanted.current = false; stopSpeech(); stopCapture({ status: "idle" });
    inFlight.current = null; autoSubmitted.current = false; restartCount.current = 0; manualPause.current = false;
    flow.current = { prepareEnd: 0, answerEnd: 0 }; prepareMonoEnd.current = 0;
    setError(""); setNotice("");
    if (!key || !active(key)) { transition(!ready && battleId && !done && !finalizing ? "setup" : "idle"); return; }
    const savedAnswer = readSaved(`interview-answer:${key}`);
    saveAnswer(typeof savedAnswer?.text === "string" ? savedAnswer.text : "", savedAnswer?.inputMode === "voice" ? "voice" : "typed");
    const savedFlow = readSaved(`interview-flow:${key}`);
    const oldEnd = readSaved(`interview-clock:${key}`);
    const savedEnd = Number(savedFlow?.answerEnd) || (typeof oldEnd === "number" ? oldEnd : 0);
    if (savedEnd) {
      flow.current = { prepareEnd: Number(savedFlow?.prepareEnd) || 0, answerEnd: Math.min(savedEnd, limit()) };
      if (flow.current.prepareEnd > now()) {
        prepareMonoEnd.current = performance.now() + Math.min(PREPARATION_SECONDS * 1000, flow.current.prepareEnd - now());
        setPreparation(Math.max(1, Math.ceil((flow.current.prepareEnd - now()) / 1000))); transition("preparing");
      } else { transition("preparing"); beginAnswer(); }
    } else readQuestion();
    const tick = () => {
      if (!active(key)) return;
      const end = Math.min(flow.current.answerEnd || Infinity, limit());
      const left = Math.max(0, Math.ceil((end - now()) / 1000));
      setRemaining(flow.current.answerEnd ? left : Math.max(0, Math.ceil(Math.min(budget(), limit() - now()) / 1000)));
      if (left === 0 && !autoSubmitted.current && !inFlight.current && !["sending", "waiting"].includes(phaseRef.current)) { autoSubmitted.current = true; submitRef.current?.({ automatic: true }); return; }
      if (phaseRef.current === "preparing") {
        const prep = Math.max(0, Math.ceil((prepareMonoEnd.current - performance.now()) / 1000));
        setPreparation(prep);
        if (prep === 0) beginAnswer();
      }
    };
    tick();
    const interval = setInterval(tick, 100);
    const visibility = () => {
      if (document.visibilityState !== "visible") {
        wanted.current = false; manualPause.current = true; stopCapture({ flush: true });
        if (active(key)) setNotice("Recording paused while this tab was hidden. Resume when you’re ready.");
      }
      tick();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", visibility); wanted.current = false; clearTimers(); stopSpeech(); stopCapture(); };
  }, [key, ready, done, finalizing, thinking]);

  useEffect(() => { if (done || finalizing || thinking) { wanted.current = false; stopSpeech(); stopCapture({ status: "idle" }); clearTimers(); } }, [done, finalizing, thinking]);

  useEffect(() => {
    if (!battleId) return;
    let cancelled = false;
    const resume = () => live.current.joinInterview().catch((failure) => { if (!cancelled && mounted.current) setError(failure.message); });
    resume();
    const interval = setInterval(() => { if (live.current.thinking && document.visibilityState === "visible") resume(); }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [battleId, joinInterview]);

  useEffect(() => {
    const keydown = (event) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.key === "Escape" && recognition.current) { event.preventDefault(); pauseRecording(); return; }
      if (event.code !== "Space" || event.target instanceof HTMLElement && (/^(INPUT|TEXTAREA|BUTTON|A|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable)) return;
      if (phaseRef.current !== "answering" || live.current.mode !== "voice") return;
      event.preventDefault();
      if (recognition.current) pauseRecording(); else resumeRecording();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  return {
    phase, ready, answer, remaining, preparation, capture, permission, permissionBusy, microphoneName, audioTest, mode, autoRecord, voiceEnabled, speaking, notice, error,
    voiceAvailable: Boolean(RecognitionAPI()), playbackAvailable: canSpeak(),
    microphoneAvailable: Boolean(navigator.mediaDevices?.getUserMedia),
    paused: manualPause.current,
    sending: phase === "sending" || phase === "waiting",
    setNotice, setError,
    changeAnswer: (text) => saveAnswer(text, "typed"),
    chooseMode, toggleAutoRecord, toggleVoice, replayQuestion, pauseRecording, resumeRecording, enableMicrophone, testSpeaker, completeSetup, submit,
  };
}
