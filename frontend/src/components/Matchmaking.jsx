import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  CheckCircle2, Circle, Clock3, Code2, Cpu, Gem, LoaderCircle, MapPin,
  Minimize2, Shield, Swords, Trophy, Users, X,
} from "lucide-react";

let matchmakingAudio = null;

async function enableMatchmakingAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!matchmakingAudio || matchmakingAudio.state === "closed") {
    matchmakingAudio = new AudioContextClass();
  }
  if (matchmakingAudio.state !== "running") await matchmakingAudio.resume();
  return matchmakingAudio.state === "running" ? matchmakingAudio : null;
}

async function playTone(frequency = 660, duration = 0.18, volume = 0.12) {
  try {
    const context = await enableMatchmakingAudio();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + 0.01;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch {
    // Browsers may require another explicit click to unlock device audio.
  }
}

function Corner({ className = "" }) {
  return <span aria-hidden="true" className={`absolute h-4 w-4 border-[#c5a17a] ${className}`} />;
}

export function QueueOverlay({ onFound, onMinimize, onClose }) {
  const { user } = useAuth();
  const frameRef = useRef(null);
  const startedRef = useRef(Date.now());

  useEffect(() => {
    const tick = () => {
      const doc = frameRef.current?.contentDocument;
      if (!doc) return;
      const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);
      const minutes = doc.getElementById("queue-timer-minutes");
      const seconds = doc.getElementById("queue-timer-seconds");
      if (minutes) minutes.textContent = String(Math.floor(elapsed / 60)).padStart(2, "0");
      if (seconds) seconds.textContent = String(elapsed % 60).padStart(2, "0");
    };
    const timer = window.setInterval(tick, 1000);
    const keydown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", keydown);
    return () => { window.clearInterval(timer); window.removeEventListener("keydown", keydown); };
  }, [onClose]);

  function connectQueue() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.parentElement.closest("script, style")) continue;
      walker.currentNode.textContent = walker.currentNode.textContent.replaceAll("v0id_runner", user?.username || "You");
    }
    const runtimes = Array.from(doc.querySelectorAll(".runtime-toggle-item"));
    runtimes.forEach((button, index) => button.setAttribute("aria-pressed", String(index === 0)));
    doc.addEventListener("click", (event) => {
      if (event.target.closest("#cancel-queue-action")) { event.preventDefault(); onClose(); return; }
      const runtime = event.target.closest(".runtime-toggle-item");
      if (runtime) runtimes.forEach((button) => {
        const active = button === runtime;
        button.setAttribute("aria-pressed", String(active));
        button.className = `runtime-toggle-item py-1.5 px-2 rounded text-xs transition-all text-center flex items-center justify-center gap-1 ${active ? "bg-primary-container text-on-primary font-bold" : "bg-surface-container text-muted hover:text-white"}`;
      });
    });
    doc.addEventListener("keydown", (event) => { if (event.key === "Escape") onClose(); });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-[45] bg-[#0d0f11]">
      <iframe ref={frameRef} src="/matchmaking-queue.html" title="Matchmaking queue preview" onLoad={connectQueue} className="h-full w-full border-0" />
      <div className="absolute bottom-4 right-4 flex gap-2 rounded-lg border border-white/10 bg-[#16191c] p-2 shadow-xl"><button onClick={onMinimize} className="rounded px-3 py-2 text-xs text-[#aab1bf] hover:bg-white/5">Minimize</button><button onClick={() => { void enableMatchmakingAudio().catch(() => {}); onFound(); }} className="rounded border border-[#fddf49]/30 px-3 py-2 text-xs text-[#fddf49] hover:bg-[#fddf49]/10">Preview match found (demo)</button></div>
    </div>
  );
}

function PlayerCard({ user, rival = false }) {
  const name = rival ? "KageNinja_99" : user?.username || "You";
  const wins = Number(user?.stats?.wins || 0);
  const losses = Number(user?.stats?.losses || 0);
  const winrate = wins + losses ? `${(wins / (wins + losses) * 100).toFixed(1)}%` : "--";
  return <article className={`overflow-hidden rounded-lg border border-white/[.08] border-t-2 bg-[#191c1d] ${rival ? "border-t-[#c54c60]" : "border-t-[#fddf49]"}`}>
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-lg font-semibold ${rival ? "border-[#c54c60]/30 bg-[#39222a] text-[#e692a0]" : "border-[#fddf49]/30 bg-[#36321c] text-[#fddf49]"}`}>{!rival && user?.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-[#f0f1f4]">{name}</h2><p className={`mt-1 text-xs ${rival ? "text-[#d896a1]" : "text-[#fddf49]"}`}>{rival ? "CHALLENGER" : "YOU"}<span className="ml-2 text-[#9299a7]">{rival ? "2,385" : Number(user?.rating ?? 1200).toLocaleString()} RR</span></p></div></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${rival ? "bg-[#234139] text-[#94cdb7]" : "bg-[#fddf49]/10 text-[#fddf49]"}`}>{rival ? "READY / ACCEPTED" : "AWAITING ACCEPTANCE"}</span></div>
    <div className="mx-3 flex flex-wrap justify-between gap-2 rounded-md bg-[#222627] px-3 py-2.5 text-xs sm:mx-4"><span className="text-[#d7d7d1]">Stack: {rival ? "Rust 1.76" : "Python 3.11"}</span><span className="text-[#9299a7]">Isolated sandbox</span></div>
    <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-4 sm:p-6">{[["WINRATE", rival ? "68.8%" : winrate], ["STREAK", rival ? "3" : "--"], ["PEAK APM", rival ? "386" : "--"], ["LATENCY", rival ? "16ms" : "12ms"]].map(([label, value], index) => <div key={label} className="rounded-md bg-[#222627] p-2"><p className="text-[10px] text-[#9299a7]">{label}</p><p className={`mt-2 text-sm font-semibold ${index === 3 ? "text-[#fddf49]" : "text-[#e5e7eb]"}`}>{value}</p></div>)}</div>
    <div className="flex flex-wrap justify-between gap-2 border-t border-white/5 px-3 py-3 text-[11px] text-[#9299a7] sm:px-4"><span>{rival ? "Demo opponent" : `${wins} wins / ${losses} losses`}</span><span>{rival ? "Match preview" : "Ready for your next challenge"}</span></div>
  </article>;
}

export function MatchFound({ onClose, onAccepted }) {
  const { user } = useAuth();
  const [seconds, setSeconds] = useState(30);
  const acceptingRef = useRef(false);
  const lastSoundRef = useRef(null);
  useEffect(() => {
    if (lastSoundRef.current === seconds) return;
    lastSoundRef.current = seconds;
    if (seconds === 30) playTone(880, 0.35, 0.1);
    else if (seconds > 0) playTone(620, 0.1, 0.12);
    else playTone(260, 0.3);
  }, [seconds]);
  const finished = seconds === 0;
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  function accept() {
    if (finished || acceptingRef.current) return;
    acceptingRef.current = true;
    playTone(880);
    onAccepted?.();
  }
  useEffect(() => {
    const keydown = (event) => {
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName)) return;
      if (event.code === "Space") { event.preventDefault(); accept(); }
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [finished, onClose, onAccepted]);

  return <section className="match-found-screen relative isolate min-h-[calc(100vh-64px)] overflow-hidden bg-[#0d0f11] text-[#e5e7eb]">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ backgroundImage: "radial-gradient(ellipse at 20% 45%,#fddf4914,transparent 60%),radial-gradient(ellipse at 100% 65%,#ac253214,transparent 60%),radial-gradient(#ffffff0a 1px, transparent 1px)", backgroundSize: "auto,auto,24px 24px" }} />
    <div className="mx-auto flex max-w-[1080px] flex-col gap-4 px-4 py-4 sm:px-4 sm:py-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/[.06] bg-[#0c0e10] p-4"><div className="flex items-center gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fddf49] text-[#24200b]"><Swords size={23} /></span><div><h1 className="text-sm font-semibold sm:text-base">MATCH FOUND // 1V1 RANKED DUEL</h1><p className="mt-1.5 text-xs text-[#9299a7]">Match preview <span className="mx-2">/</span> US-East <span className="mx-2">/</span><span className="text-[#fddf49]">12ms synced</span></p></div></div><div className="flex items-center gap-4"><button type="button" onClick={() => { void playTone(880, 0.3, 0.16); }} className="rounded-md border border-white/10 px-2 py-1.5 text-[10px] text-[#fddf49] hover:bg-white/5">Enable / test sound</button><div className="text-right"><p className="text-xs font-semibold text-white">{finished ? "MATCH EXPIRED" : "CONFIRM YOUR DUEL"}</p><p className={`mt-1 text-[11px] ${finished ? "text-[#dc8895]" : "text-[#9299a7]"}`}>{finished ? "Return to queue to try again" : `Accept within ${seconds}s`}</p></div><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#fddf49]/60 font-mono text-sm text-[#fddf49]">{seconds}</span></div></header>
      <div className="grid items-center gap-3 py-2 lg:grid-cols-[1fr_110px_1fr] lg:py-3"><PlayerCard user={user} /><div className="flex flex-col items-center gap-3 py-3 text-center"><div className="flex h-14 w-14 rotate-45 items-center justify-center rounded-lg border border-[#fddf49]/20 bg-[#282a25]"><b className="-rotate-45 text-xl italic text-[#fddf49]">VS</b></div><div className="mt-2 text-xs leading-6"><p className="text-[#fddf49]">WIN: +35 RR</p><p className="text-[#df7787]">LOSS: -22 RR</p></div><div className="text-xs"><p className="text-[#9299a7]">TARGET PROBLEM</p><p className="mt-2 text-white">Two Sum</p><span className="mt-2 inline-block rounded bg-[#213a30] px-2 py-1 text-[10px] text-[#94cdb7]">EASY / ARRAYS</span></div></div><PlayerCard rival /></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><button onClick={finished ? onClose : accept} className="flex min-h-8 items-center justify-center gap-3 rounded-lg bg-[#fddf49] px-3 py-2 text-[11px] font-semibold text-[#24200b] shadow-[0_0_24px_#fddf491a] hover:bg-[#ffe76e]"><Swords size={18} />{finished ? "RETURN TO QUEUE" : "LOCK IN DUEL (SPACEBAR)"}</button><button onClick={onClose} className="flex min-h-8 items-center justify-center gap-2 rounded-lg border border-[#9e4950]/25 bg-[#281a1e] px-4 py-2 text-[11px] font-semibold text-[#e4a1aa]"><X size={16} />DECLINE MATCH (ESC)</button></div>
      <p className="text-center text-[10px] text-[#737c8c]">Demo matchmaking / accepting or declining does not change your rating.</p>
    </div>
  </section>;
}
