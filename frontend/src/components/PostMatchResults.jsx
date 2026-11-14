import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import {
  ArrowUp, Award, BrainCircuit, CheckCircle2, CircleHelp,
  Mic, MicOff, Radio, TrendingUp, Trophy, Volume2, VolumeX, X,
} from "lucide-react";

const analysis = "Your solution cleared the evaluation suite in an isolated Docker sandbox. In a technical interview follow-up, consider potential memory and runtime trade-offs if test input sizes scale to streaming constraints.";

export default function PostMatchResults({ onClose, onContinue, onQueueNext }) {
  const { user } = useAuth();
  const { battleResult } = useBattle();

  const [sound, setSound] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [notice, setNotice] = useState("");
  const recognizer = useRef(null);
  const utterance = useRef(null);

  const players = battleResult?.players || [];
  const myPlayer = players.find(
    (p) => (user?._id && p.userId === String(user._id)) || p.username === user?.username
  ) || players[0];
  const oppPlayer = players.find((p) => p !== myPlayer) || players[1];

  const totalTests = myPlayer?.totalTests || 15;
  const passedCount = myPlayer?.passedCount ?? 0;
  const ratingDelta = myPlayer?.ratingDelta;
  const deltaText = ratingDelta != null ? (ratingDelta >= 0 ? `+${ratingDelta} RR` : `${ratingDelta} RR`) : "+0 RR";
  const myRuntime = myPlayer?.runtimeMs != null ? `${myPlayer.runtimeMs}ms` : "—";
  const oppRuntime = oppPlayer?.runtimeMs != null ? `${oppPlayer.runtimeMs}ms` : "—";

  const isWin = battleResult?.winner && (battleResult.winner === String(user?._id) || (myPlayer && myPlayer.ratingDelta > 0));
  const isDraw = battleResult?.reason === "draw" || !battleResult?.winner;
  const verdictText = isWin ? "VICTORY // MATCH WON" : isDraw ? "DRAW // TIME EXPIRED" : "DEFEAT // MATCH CONCLUDED";

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
      setNotice("Microphone ready.");
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
    instance.onerror = () => setNotice("Microphone access unavailable.");
    instance.onend = () => setMicActive(true);
    recognizer.current = instance;
    try {
      instance.start();
      setMicActive(false);
      setNotice("Listening for your answer…");
    } catch {
      setNotice("Could not start microphone.");
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
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold ${isWin ? "bg-emerald-400 text-black" : isDraw ? "bg-amber-400 text-black" : "bg-rose-500 text-white"}`}>
              <CheckCircle2 size={14} />{passedCount}/{totalTests} TESTS PASSED
            </span>
            <h1 className="text-sm font-semibold tracking-wide text-[#b2a0d8] sm:text-base">{verdictText}</h1>
            <span className="rounded-sm bg-[#2a2b2e] px-2 py-1 font-mono text-[10px] font-bold text-[#b2a0d8]">{deltaText}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} aria-label="Close results" className="rounded-sm bg-[#2a2b2e] p-2 text-[#aaa] hover:text-white"><X size={18} /></button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[1.25fr_.9fr]">
          <section className="flex min-h-[460px] flex-col rounded-lg border border-white/[.05] bg-[#202124] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-[#c5a17a]/70 bg-[#c5a17a]/10 text-[#b2a0d8] shadow-[0_0_22px_rgba(197,161,122,.16)]">
                  <BrainCircuit size={25} />
                  <i className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#202124] bg-[#c5a17a]" />
                </span>
                <div>
                  <h2 className="font-bold text-white">BerryBot <span className="ml-1 rounded-sm bg-[#c5a17a]/20 px-1.5 py-1 text-[10px] font-bold text-[#b2a0d8]">TECHNICAL ARBITER</span></h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[#999]"><span className="h-2 w-2 rounded-full bg-[#c5a17a]" /> AST Analysis &amp; Performance Review</p>
                </div>
              </div>
              <span className={`px-2.5 py-1.5 text-[10px] font-bold ${speaking ? "bg-[#131616] text-[#b2a0d8]" : "bg-[#131616] text-[#999]"}`}>{speaking ? "SPEAKING" : "READY"}</span>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-sm border border-white/[.05] bg-[#191a1c] px-3 py-2.5">
              <Volume2 size={17} className="shrink-0 text-[#b2a0d8]" />
              <span className="text-xs text-[#999]">Voice Synthesizer:</span>
              <div className="flex flex-1 items-center justify-center gap-1">
                {[0,1,2,3,4,5,6,7,8,9,10,11].map((i) => (
                  <span key={i} className={`w-1 rounded-full bg-[#c5a17a] ${speaking ? "animate-pulse" : "opacity-40"}`} style={{ height: `${8 + ((i * 7 + 3) % 14)}px`, animationDelay: `${i * 55}ms` }} />
                ))}
              </div>
            </div>

            <div className="mt-3 flex-1 rounded-sm border border-white/[.06] bg-[#18191b] p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.07] pb-3">
                <h3 className="flex items-center gap-2 font-mono text-xs font-bold text-[#b2a0d8]">
                  <BrainCircuit size={15} /> Match Analysis
                </h3>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#e0e0e0]">
                {isWin ? "Decisive victory in this 1v1 duel." : isDraw ? "Competitive match ended in a draw." : "Duel completed. Review opponent telemetry to refine your approach."}
              </p>
              <div className="mt-3 rounded-sm border border-white/[.1] bg-[#202124] p-3">
                <h4 className="flex items-center gap-2 font-mono text-xs font-bold text-[#b2a0d8]"><CircleHelp size={14} /> Technical Notes:</h4>
                <textarea aria-label="Notes" value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Type notes or follow-up solution thoughts here..." className="mt-2 min-h-[58px] w-full resize-y bg-transparent font-mono text-xs leading-5 text-[#bbb] outline-none placeholder:text-[#888]" />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[.08] pt-3">
              <button onClick={toggleMic} className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold shadow-[0_0_18px_rgba(197,161,122,.12)] ${micActive ? "bg-[#c5a17a] text-[#261f18]" : "bg-[#2a2b2e] text-[#b2a0d8]"}`}>{micActive ? <Mic size={16} /> : <MicOff size={16} />}{micActive ? "Mic Active" : "Listening…"}</button>
              <button onClick={() => setSound(!sound)} aria-label={sound ? "Mute" : "Enable audio"} className="rounded-sm bg-[#2a2b2e] p-2 text-[#bbb] hover:text-[#b2a0d8]">{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
              <button onClick={speakAnalysis} aria-label="Play analysis" className="rounded-sm bg-[#2a2b2e] p-2 text-[#bbb] hover:text-[#b2a0d8]"><Radio size={17} /></button>
            </div>
            {notice && <p role="status" className="mt-2 text-[11px] text-[#aaa]">{notice}</p>}
          </section>

          <section className="flex flex-col rounded-lg border border-white/[.05] bg-[#202124] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-white/[.08] pb-3">
              <h2 className="flex items-center gap-2 font-bold text-white"><Trophy size={17} className="text-[#b2a0d8]" /> MATCH TELEMETRY SUMMARY</h2>
              <span className="rounded-sm bg-[#2a2b2e] px-2 py-1.5 font-mono text-[10px] font-bold text-[#b2a0d8]">{battleResult?.battleId ? battleResult.battleId.slice(-8).toUpperCase() : "DUEL"}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric title="Your Tests" value={`${passedCount}/${totalTests}`} note="" />
              <Metric title="Your Runtime" value={myRuntime} note="" />
              <Metric title="Opponent Tests" value={`${oppPlayer?.passedCount ?? 0}/${oppPlayer?.totalTests ?? totalTests}`} note={`(${oppPlayer?.username || "Opponent"})`} />
              <Metric title="Opponent Runtime" value={oppRuntime} note="" />
            </div>
            <div className="mt-2 flex items-center gap-3 bg-[#191a1c] p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#c5a17a] text-[#261f18]"><ArrowUp size={24} /></span>
              <div className="min-w-0 flex-1">
                <b className="text-sm text-white">Rating Update</b>
                <p className="text-xs text-[#999]">{myPlayer?.ratingBefore ?? 1200} RR → <strong className="text-[#b2a0d8]">{myPlayer?.ratingAfter ?? (myPlayer?.ratingBefore ?? 1200)} RR ({deltaText})</strong></p>
              </div>
              <span className="bg-[#2a2b2e] px-2 py-1 text-xs font-semibold text-[#b2a0d8]">{user?.tier || "RANKED"}</span>
            </div>
            <div className="mt-auto space-y-2 pt-4">
              <button onClick={onContinue} className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#c5a17a] px-4 py-3.5 text-sm font-semibold tracking-wide text-[#261f18] shadow-[0_0_18px_rgba(197,161,122,.12)] transition hover:bg-[#d3b18c]">
                <TrendingUp size={18} />VIEW POST-MORTEM REPORT
              </button>
              <button onClick={onQueueNext} className="flex w-full items-center justify-center gap-2 rounded-sm border border-white/[.08] bg-[#202124] px-4 py-3 text-xs font-bold text-[#ddd] transition hover:border-[#c5a17a]/30 hover:text-[#b2a0d8]">
                <Award size={17} />QUEUE NEXT DUEL MATCHMAKING
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, note }) {
  return (
    <div className="min-h-[66px] bg-[#191a1c] p-2.5">
      <p className="text-xs text-[#999]">{title}</p>
      <p className="mt-1 font-mono text-sm font-bold text-[#b2a0d8]">{value} <span className="font-sans text-[10px] font-normal text-[#999]">{note}</span></p>
    </div>
  );
}
