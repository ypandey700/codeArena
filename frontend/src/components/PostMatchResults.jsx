import { useEffect, useRef, useState } from "react";
import {
  ArrowUp, Award, BrainCircuit, CheckCircle2, CircleHelp, FileText,
  Mic, MicOff, Radio, TrendingUp, Trophy, Volume2, VolumeX, X,
} from "lucide-react";

const analysis = "Your two-pointer monotonic stack solution cleared all 15 test cases in 11ms with O(1) space, v0id_runner! But in an actual LeetCode Hard follow-up interview scenario: If the elevation array height[] allows dynamic stream updates with negative heights representing Byzantine drainage sinks, how would you adapt your monotonic fence invariant to avoid O(n²) worst-case partition re-computation while maintaining O(1) auxiliary space?";

export default function PostMatchResults({ onClose, onContinue, onQueueNext }) {
  const [sound, setSound] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [speaking, setSpeaking] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [notice, setNotice] = useState("");
  const recognizer = useRef(null);
  const utterance = useRef(null);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    recognizer.current?.stop?.();
  }, []);

  function speakAnalysis() {
    if (!sound || !("speechSynthesis" in window)) {
      setNotice("Speech playback is unavailable in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    utterance.current = new SpeechSynthesisUtterance(analysis);
    utterance.current.rate = 1.03;
    utterance.current.pitch = 1.08;
    utterance.current.onstart = () => setSpeaking(true);
    utterance.current.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance.current);
  }

  function toggleMic() {
    if (!micActive) {
      setMicActive(true);
      setNotice("Microphone ready. Hold Space to answer BerryBot.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice("Voice input is not supported here. Type your answer below.");
      setMicActive(false);
      return;
    }
    const instance = new SpeechRecognition();
    instance.lang = "en-US";
    instance.interimResults = false;
    instance.onresult = (event) => setTranscript(event.results?.[0]?.[0]?.transcript || "");
    instance.onerror = () => setNotice("Microphone access was unavailable. You can type your answer instead.");
    instance.onend = () => setMicActive(true);
    recognizer.current = instance;
    try {
      instance.start();
      setMicActive(false);
      setNotice("Listening for your answer…");
    } catch {
      setNotice("Could not start microphone input. You can type your answer instead.");
    }
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.code === "Space" && event.target?.tagName !== "TEXTAREA" && event.target?.tagName !== "INPUT") {
        event.preventDefault();
        toggleMic();
      }
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 px-3 py-6 backdrop-blur-md sm:px-6">
      <section role="dialog" aria-modal="true" aria-label="Match results" className="my-auto flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#c5a17a]/40 bg-[#202124] shadow-[0_0_50px_rgba(197,161,122,.15)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] bg-[#18191b] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2.5"><span className="flex items-center gap-1.5 rounded-sm bg-[#c5a17a] px-2.5 py-1 text-xs font-semibold text-[#261f18]"><CheckCircle2 size={14} />15/15 TESTS PASSED</span><h1 className="text-sm font-semibold tracking-wide text-[#b2a0d8] sm:text-base">VICTORY // SUBMISSION VALIDATED</h1><span className="rounded-sm bg-[#2a2b2e] px-2 py-1 font-mono text-[10px] font-bold text-[#b2a0d8]">+35 RR</span></div>
          <div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-sm bg-[#2a2b2e] px-2.5 py-1.5 font-mono text-[10px] text-[#aaa] sm:flex"><BrainCircuit size={13} className="text-[#b2a0d8]" /> Agentic Technical Arbiter Active</span><button onClick={onClose} aria-label="Close results" className="rounded-sm bg-[#2a2b2e] p-2 text-[#aaa] hover:text-white"><X size={18} /></button></div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[1.25fr_.9fr]">
          <section className="flex min-h-[460px] flex-col rounded-lg border border-white/[.05] bg-[#202124] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-3"><span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-[#c5a17a]/70 bg-[#c5a17a]/10 text-[#b2a0d8] shadow-[0_0_22px_rgba(197,161,122,.16)]"><BrainCircuit size={25} /><i className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#202124] bg-[#c5a17a]" /></span><div><h2 className="font-bold text-white">BerryBot <span className="ml-1 rounded-sm bg-[#c5a17a]/20 px-1.5 py-1 text-[10px] font-bold text-[#b2a0d8]">VOICE AI ARBITER</span></h2><p className="mt-1 flex items-center gap-1.5 text-xs text-[#999]"><span className="h-2 w-2 rounded-full bg-[#c5a17a]" /> Live Oral Defense &amp; AST Analysis</p></div></div><span className={`px-2.5 py-1.5 text-[10px] font-bold ${speaking ? "bg-[#131616] text-[#b2a0d8]" : "bg-[#131616] text-[#999]"}`}>{speaking ? "SPEAKING" : "READY"}</span></div>

            <div className="mt-3 flex items-center gap-3 rounded-sm border border-white/[.05] bg-[#191a1c] px-3 py-2.5"><Volume2 size={17} className="shrink-0 text-[#b2a0d8]" /><span className="text-xs text-[#999]">Voice Synthesizer:</span><div className="flex flex-1 items-center justify-center gap-1" aria-label={speaking ? "BerryBot is speaking" : "BerryBot is ready"}>{[0,1,2,3,4,5,6,7,8,9,10,11].map((i) => <span key={i} className={`w-1 rounded-full bg-[#c5a17a] ${speaking ? "animate-pulse" : "opacity-40"}`} style={{ height: `${8 + ((i * 7 + 3) % 14)}px`, animationDelay: `${i * 55}ms` }} />)}</div><span className="hidden bg-[#2a2b2e] px-2 py-1 text-[9px] text-[#888] sm:block">16kHz PCM</span></div>

            <div className="mt-3 flex-1 rounded-sm border border-white/[.06] bg-[#18191b] p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.07] pb-3"><h3 className="flex items-center gap-2 font-mono text-xs font-bold text-[#b2a0d8]"><BrainCircuit size={15} /> BerryBot Live Follow-Up &amp; AST Analysis:</h3><div className="flex gap-1.5"><span className="bg-[#2a2b2e] px-2 py-1 text-[10px] text-[#aaa]">LeetCode #42</span><span className="bg-red-800 px-2 py-1 text-[10px] font-bold text-white">HARD</span></div></div>
              <div className="mt-3 rounded-sm bg-[#2a2b2e] px-2.5 py-2 font-mono text-[11px] font-bold text-[#b2a0d8]">LeetCode #42 · Byzantine Raft Partition Arbiter (Hard)</div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#e0e0e0]">“Your two-pointer monotonic stack solution cleared all 15 test cases in 11ms with <code className="text-[#b2a0d8]">O(1)</code> space, <code className="text-[#b2a0d8]">v0id_runner</code>! But in an actual LeetCode Hard follow-up interview scenario: <code className="text-[#b2a0d8]">If the elevation array height[] allows dynamic stream updates with negative heights representing Byzantine drainage sinks, how would you adapt your monotonic fence invariant to avoid O(n²) worst-case partition re-computation while maintaining O(1) auxiliary space?</code>”</p>
              <div className="mt-3 rounded-sm border border-white/[.1] bg-[#202124] p-3"><h4 className="flex items-center gap-2 font-mono text-xs font-bold text-[#b2a0d8]"><CircleHelp size={14} /> Follow-up Interview Constraint:</h4><textarea aria-label="Answer BerryBot's follow-up" value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Can you guarantee strictly monotonic epoch guarantees when height[i] ∈ [-10⁵, 10⁵]?" className="mt-2 min-h-[58px] w-full resize-y bg-transparent font-mono text-xs leading-5 text-[#bbb] outline-none placeholder:text-[#888]" /></div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[.08] pt-3"><button onClick={toggleMic} className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold shadow-[0_0_18px_rgba(197,161,122,.12)] ${micActive ? "bg-[#c5a17a] text-[#261f18]" : "bg-[#2a2b2e] text-[#b2a0d8]"}`}>{micActive ? <Mic size={16} /> : <MicOff size={16} />}{micActive ? "Mic Active · Space to Talk" : "Listening…"}</button><button onClick={() => setSound(!sound)} aria-label={sound ? "Mute BerryBot" : "Enable BerryBot audio"} className="rounded-sm bg-[#2a2b2e] p-2 text-[#bbb] hover:text-[#b2a0d8]">{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button><button onClick={speakAnalysis} aria-label="Play BerryBot analysis" className="rounded-sm bg-[#2a2b2e] p-2 text-[#bbb] hover:text-[#b2a0d8]"><Radio size={17} /></button><span className="ml-auto font-mono text-[10px] text-[#888]">Audio Latency: 42ms (Neural WebSocket)</span></div>
            {notice && <p role="status" className="mt-2 text-[11px] text-[#aaa]">{notice}</p>}
          </section>

          <section className="flex flex-col rounded-lg border border-white/[.05] bg-[#202124] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-white/[.08] pb-3"><h2 className="flex items-center gap-2 font-bold text-white"><Trophy size={17} className="text-[#b2a0d8]" /> MATCH TELEMETRY SUMMARY</h2><span className="rounded-sm bg-[#2a2b2e] px-2 py-1.5 font-mono text-[10px] font-bold text-[#b2a0d8]">MATCH #918-BZT</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric title="Time Complexity" value="O(n)" note="(Optimal)" />
              <Metric title="Space Complexity" value="O(1)" note="(In-Place)" />
              <Metric title="Memory Efficiency" value="42.4 MB" note="Top 99.2%" />
              <Metric title="Elegance Score" value="98 / 100" note="(AST Guard)" />
            </div>
            <div className="mt-2 flex items-center gap-3 bg-[#191a1c] p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#c5a17a] text-[#261f18]"><ArrowUp size={24} /></span><div className="min-w-0 flex-1"><b className="text-sm text-white">Rating Tier Up!</b><p className="text-xs text-[#999]">2,375 RR → <strong className="text-[#b2a0d8]">2,410 RR (+35)</strong></p></div><span className="bg-[#2a2b2e] px-2 py-1 text-xs font-semibold text-[#b2a0d8]">RADIANT #11</span></div>
            <div className="flex items-center justify-between gap-2 py-3 font-mono text-[10px] text-[#888]"><span>Docker Sandbox Quorum Check:</span><b className="text-[#b2a0d8]">11ms (All passed)</b></div>
            <div className="mt-auto space-y-2 pt-4">
              <button onClick={onContinue} className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#c5a17a] px-4 py-3.5 text-sm font-semibold tracking-wide text-[#261f18] shadow-[0_0_18px_rgba(197,161,122,.12)] transition hover:bg-[#d3b18c]"><TrendingUp size={18} />CONTINUE TO RATING BREAKDOWN (+35 RR)</button>
              <button onClick={onQueueNext} className="flex w-full items-center justify-center gap-2 rounded-sm border border-white/[.08] bg-[#202124] px-4 py-3 text-xs font-bold text-[#ddd] transition hover:border-[#c5a17a]/30 hover:text-[#b2a0d8]"><Award size={17} /> QUEUE NEXT DUEL MATCHMAKING</button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, note }) {
  return <div className="min-h-[66px] bg-[#191a1c] p-2.5"><p className="text-xs text-[#999]">{title}</p><p className="mt-1 font-mono text-sm font-bold text-[#b2a0d8]">{value} <span className="font-sans text-[10px] font-normal text-[#999]">{note}</span></p></div>;
}
