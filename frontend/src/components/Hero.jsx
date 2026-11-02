import { ArrowRight, Flame, MessageCircle, Play, Sparkles, Swords } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Hero({ battleStarted, onSignup, onToggleBattle }) {
  const { user, openSignup } = useAuth();
  const navigate = useNavigate();

  const handleAction = () => {
    if (user) {
      navigate("/profile");
    } else if (onSignup) {
      onSignup();
    } else {
      openSignup();
    }
  };
  return (
    <section
      id="home"
      data-cursor-section="hero"
      className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 pb-20 pt-8 sm:px-8 sm:pt-12 lg:min-h-[650px] lg:grid-cols-[.95fr_1.05fr] lg:gap-0 lg:px-10 lg:pb-24 lg:pt-10"
    >
      <div className="relative z-10 max-w-xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[.07] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[.15em] text-lime-200">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_10px_#bef264]" />
          The coding arena for your next level
        </div>
        <h1 className="text-[clamp(2.5rem,7.3vw,6rem)] font-semibold leading-[.95] tracking-[-.07em] text-white">
          Get better
          <br />
          at code.{" "}
          <span className="bg-gradient-to-r from-lime-300 via-sky-300 to-violet-300 bg-clip-text font-serif font-normal italic text-transparent">
            Together.
          </span>
        </h1>
        <p className="mt-6 max-w-md text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
          Trade lonely practice for friendly competition. Take on a real rival, write cleaner code, and make every round count.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            data-magnetic
            onClick={handleAction}
            className="group rounded-xl bg-lime-300 px-6 py-3.5 text-sm font-bold text-[#101512] transition hover:-translate-y-0.5 hover:bg-lime-200"
          >
            Play your first duel{" "}
            <ArrowRight size={17} className="ml-2 inline transition group-hover:translate-x-1" />
          </button>
          <a
            href="#modes"
            className="flex items-center gap-2 rounded-xl border border-sky-300/20 px-5 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-sky-300/45 hover:bg-sky-300/[.05]"
          >
            <Play size={16} className="text-sky-300" /> Explore the modes
          </a>
        </div>
        <div className="mt-8 flex items-center gap-3 text-xs text-slate-500">
          <span className="flex -space-x-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0b100f] bg-violet-400 text-[9px] font-bold text-[#16131e]">
              A
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0b100f] bg-orange-300 text-[9px] font-bold text-[#20170f]">
              M
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0b100f] bg-sky-300 text-[9px] font-bold text-[#101a1e]">
              J
            </span>
          </span>
          <span>Better practice is more fun together.</span>
        </div>
      </div>

      <div className="arena-perspective relative mx-auto flex min-h-[390px] w-full max-w-[590px] items-center justify-center sm:min-h-[480px] lg:min-h-[550px]">
        <div className="arena-glow absolute h-[65%] w-[65%] rounded-full blur-[42px]" />
        <div className="arena-orbit arena-orbit-one absolute h-[84%] w-[84%] rounded-full border border-lime-200/[.12]" />
        <div className="arena-orbit arena-orbit-two absolute h-[67%] w-[94%] rounded-full border border-sky-200/[.10]" />
        <div className="arena-orbit arena-orbit-three absolute h-[90%] w-[52%] rounded-full border border-violet-200/[.09]" />

        <div className="arena-float relative z-10 w-[83%] max-w-[440px] [transform-style:preserve-3d]">
          <div
            data-tilt
            data-cursor="card"
            className="arena-tilt overflow-hidden rounded-2xl border border-white/[.12] bg-[#111816]/95 shadow-[0_28px_90px_rgba(0,0,0,.65)] [transform:rotateY(-8deg)_rotateX(4deg)]"
          >
            <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-300/10 text-lime-300">
                  <Swords size={18} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Ranked Duel</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">JavaScript · Round 01</div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-lime-300/10 px-2.5 py-1 text-[10px] font-semibold text-lime-300">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-300" /> LIVE
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-300/15 text-[10px] font-bold text-violet-200">
                  Y
                </span>
                <span className="text-xs text-slate-300">you</span>
              </div>
              <span className="font-mono text-xs text-slate-600">VS</span>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-slate-300">byteBard</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-300/15 text-[10px] font-bold text-orange-200">
                  B
                </span>
              </div>
            </div>

            <div className="px-5 pb-5 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">Find the first unique character</span>
                <span className="font-mono text-[10px] text-lime-300">08:42</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/[.07] bg-[#0b100f]">
                <div className="flex h-8 items-center gap-1.5 border-b border-white/[.05] px-3">
                  <i className="h-1.5 w-1.5 rounded-full bg-rose-400/70" />
                  <i className="h-1.5 w-1.5 rounded-full bg-amber-300/70" />
                  <i className="h-1.5 w-1.5 rounded-full bg-lime-300/70" />
                  <span className="ml-2 font-mono text-[9px] text-slate-600">solution.js</span>
                </div>
                <pre className="overflow-hidden px-4 py-4 font-mono text-[10px] leading-[1.9] text-slate-400 sm:text-[11px]">
                  <span className="text-violet-300">function</span> <span className="text-sky-300">firstUnique</span>
                  (str) {"{"}
                  <br />
                  {"  "}
                  <span className="text-violet-300">const</span> counts = {"{};"}
                  <br />
                  {"  "}
                  <span className="text-pink-300">for</span> (<span className="text-violet-300">const</span> char{" "}
                  <span className="text-pink-300">of</span> str) {"{"}
                  <br />
                  {"    "}counts[char] = (counts[char] || <span className="text-orange-200">0</span>) +{" "}
                  <span className="text-orange-200">1</span>;
                  <br />
                  {"  }"}
                  <br />
                  {"  "}
                  <span className="text-pink-300">return</span> [...str].find((c) =&gt; counts[c] ==={" "}
                  <span className="text-orange-200">1</span>);
                  <br />
                  {"}"}
                </pre>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <MessageCircle size={13} /> nice approach!
                </span>
                <span className="text-[10px] text-slate-500">
                  Tests <span className="text-lime-300">4/5</span>
                </span>
              </div>
              <button
                onClick={onToggleBattle}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-lime-300/20 bg-lime-300/[.08] py-2.5 text-xs font-semibold text-lime-200 transition hover:bg-lime-300/[.14]"
              >
                <Play size={15} /> {battleStarted ? "You’re in the arena — nice!" : "Jump into the arena"}
              </button>
            </div>
          </div>
        </div>

        <div className="arena-chip arena-chip-top absolute right-[1%] top-[-3%] z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-[#161e1a] px-3 py-2.5 shadow-xl">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-300/10 text-orange-300">
            <Flame size={16} />
          </span>
          <span>
            <span className="block text-[10px] font-semibold text-white">4 day streak</span>
            <span className="block text-[9px] text-slate-500">Keep it going</span>
          </span>
        </div>
        <div className="arena-cube absolute left-[8%] top-[18%] z-20" aria-hidden="true">
          <span className="cube-face cube-face-front">
            <Swords size={17} />
          </span>
          <span className="cube-face cube-face-back">01</span>
          <span className="cube-face cube-face-right">XP</span>
          <span className="cube-face cube-face-left">VS</span>
          <span className="cube-face cube-face-top">+</span>
          <span className="cube-face cube-face-bottom">GG</span>
        </div>
        <div
          className="arena-reward absolute bottom-[-2%] right-[2%] z-20 flex items-center gap-2 rounded-xl border border-lime-300/20 bg-[#111816] px-3 py-2 shadow-[0_10px_35px_rgba(0,0,0,.45)]"
          aria-hidden="true"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-300/10 text-lime-300">
            <Sparkles size={15} />
          </span>
          <span>
            <span className="block font-mono text-[10px] font-bold text-lime-200">+120 XP</span>
            <span className="block text-[9px] text-slate-500">Round cleared</span>
          </span>
        </div>
        <span className="arena-token arena-token-one absolute left-[10%] top-[20%] font-mono text-sm text-lime-300/60">
          {"{ }"}
        </span>
        <span className="arena-token arena-token-two absolute bottom-[17%] right-[12%] font-mono text-lg text-sky-300/60">
          {"</>"}
        </span>
      </div>
    </section>
  );
}
