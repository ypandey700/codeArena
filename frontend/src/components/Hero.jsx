import { ArrowDown, CircleDot, Star, Swords, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Hero() {
  const { user, openLogin, openSignup } = useAuth();
  if (user) return null;

  return (
    <section id="home" className="reference-hero relative isolate overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse at 50% 5%, rgba(111,151,214,.13), transparent 65%)" }} />
      <div className="mx-auto flex max-w-[1120px] flex-col items-center px-5 pb-12 pt-20 text-center sm:px-8 sm:pb-16 sm:pt-28">
        <div className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-[#354057] bg-[#101722] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.06em] text-[#a9c5ef] sm:text-[10px]"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#fddf49]" />Competitive coding / Ranked 1v1 duels</div>
        <h1 className="max-w-[800px] text-[36px] font-bold leading-[1.15] tracking-[-.035em] text-[#e4eaf5] sm:text-[48px] lg:text-[60px]">Code Fast. Duel Hard.<span className="mt-1 block text-[#fddf49]">Rise to Grandmaster.</span></h1>
        <p className="mt-5 max-w-[720px] text-sm leading-6 text-[#a7b3ca] sm:text-[15px] sm:leading-7">The real-time multiplayer esports arena for competitive programmers. Battle 1v1 in algorithmic duels, run code in isolated Docker sandboxes, and explain your implementation in a code-specific AI interview.</p>
        <div className="mt-7 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"><button onClick={openSignup} className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-[#fddf49] px-6 text-[13px] font-semibold text-[#24200b] shadow-[0_5px_24px_rgba(101,149,222,.14)] transition hover:bg-[#ffe76e] sm:w-auto">Find 1v1 Duel Match <Swords size={16} /></button><button onClick={openLogin} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#354057] bg-[#101722] px-5 text-[13px] font-medium text-[#d5deed] transition hover:bg-[#202a3b] sm:w-auto"><CircleDot size={12} className="text-[#d78d95]" />Sign in</button></div>
        <a href="#live-preview" className="mt-16 flex flex-col items-center gap-3 font-mono text-[9px] uppercase tracking-[.16em] text-[#8592a8] sm:mt-20">Scroll to live arena<ArrowDown size={17} className="text-[#fddf49]" /></a>
      </div>
    </section>
  );
}
