import { ArrowUpRight, Menu, Swords, X } from "lucide-react";

export default function Navbar({ mobileNav, onToggleNav, onCloseNav, onLogin, onSignup }) {
  return (
    <header className="arena-navbar relative z-20 mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-7xl items-center justify-between rounded-2xl border border-transparent px-4 py-3 backdrop-blur-xl sm:mt-4 sm:px-6 lg:mt-5 lg:px-8">
      <a href="#home" className="flex items-center gap-2.5" aria-label="Code Arena home">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-300 text-[#101512]">
          <Swords size={21} strokeWidth={2.4} />
        </span>
        <span className="text-[19px] font-bold tracking-tight text-white">
          Code <span className="text-lime-300">Arena</span>
        </span>
      </a>

      <nav
        className={`${
          mobileNav
            ? "absolute left-4 right-4 top-[68px] flex flex-col rounded-2xl border border-white/10 bg-[#101816] p-4 shadow-xl"
            : "hidden"
        } items-center gap-7 md:static md:flex md:flex-row md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
      >
        <a onClick={onCloseNav} className="text-sm text-slate-400 transition hover:text-white" href="#modes">
          Explore modes
        </a>
        <a onClick={onCloseNav} className="text-sm text-slate-400 transition hover:text-white" href="#how-it-works">
          How it works
        </a>
        <div className="flex w-full gap-3 md:hidden">
          <button data-magnetic onClick={onLogin} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm">
            Log in
          </button>
          <button onClick={onSignup} className="flex-1 rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold text-[#101512]">
            Let’s play
          </button>
        </div>
      </nav>

      <div className="hidden items-center gap-3 md:flex">
        <button
          data-magnetic
          onClick={onLogin}
          className="px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-sky-300"
        >
          Log in
        </button>
        <button
          data-magnetic
          onClick={onSignup}
          className="rounded-xl bg-lime-300 px-5 py-2.5 text-sm font-bold text-[#101512] transition hover:bg-lime-200"
        >
          Let’s play <ArrowUpRight className="ml-1 inline" size={16} />
        </button>
      </div>

      <button
        className="rounded-lg p-2 text-slate-300 md:hidden"
        aria-label="Toggle navigation"
        aria-expanded={mobileNav}
        onClick={onToggleNav}
      >
        {mobileNav ? <X size={21} /> : <Menu size={21} />}
      </button>
    </header>
  );
}
