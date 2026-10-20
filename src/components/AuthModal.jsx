import { ArrowRight, Check, Lock, Mail, Swords, X } from "lucide-react";

function ModalShell({ title, eyebrow, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#050a09]/85 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative my-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#101816] p-6 shadow-[0_24px_100px_rgba(0,0,0,.65)] sm:p-8"
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <X size={19} />
        </button>
        <div className="mb-6">
          <span className="text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">{eyebrow}</span>
          <h2 id="dialog-title" className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoginForm({ onSubmit, onSwitch }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-300">Email</span>
        <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b100f] px-3.5 focus-within:border-lime-300/50">
          <Mail size={16} className="text-slate-500" />
          <input
            required
            type="email"
            placeholder="you@example.com"
            className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </span>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-300">Password</span>
        <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b100f] px-3.5 focus-within:border-lime-300/50">
          <Lock size={16} className="text-slate-500" />
          <input
            required
            type="password"
            placeholder="Your password"
            className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </span>
      </label>
      <button className="mt-2 w-full rounded-xl bg-lime-300 py-3.5 text-sm font-bold text-[#101512] transition hover:bg-lime-200">
        Log in to the arena <ArrowRight size={16} className="ml-1 inline" />
      </button>
      <p className="pt-1 text-center text-[11px] text-slate-500">Demo only — no account or credentials are saved.</p>
      <p className="text-center text-xs text-slate-400">
        New around here?{" "}
        <button type="button" onClick={onSwitch} className="font-semibold text-lime-300 hover:text-lime-200">
          Join the game
        </button>
      </p>
    </form>
  );
}

function SignupForm({ onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-300">Username</span>
        <input
          required
          minLength={2}
          placeholder="e.g. byteBard"
          className="w-full rounded-xl border border-white/10 bg-[#0b100f] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-lime-300/50"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-300">Preferred tech stack</span>
        <select
          defaultValue="JavaScript"
          className="w-full appearance-none rounded-xl border border-white/10 bg-[#0b100f] px-3.5 py-3 text-sm text-white outline-none focus:border-lime-300/50"
        >
          <option>JavaScript</option>
          <option>TypeScript</option>
          <option>Python</option>
          <option>Java</option>
          <option>MySQL / SQL</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-300">Skill level</span>
        <select
          defaultValue="Finding my feet"
          className="w-full appearance-none rounded-xl border border-white/10 bg-[#0b100f] px-3.5 py-3 text-sm text-white outline-none focus:border-lime-300/50"
        >
          <option>Finding my feet</option>
          <option>Getting confident</option>
          <option>Ready for a challenge</option>
        </select>
      </label>
      <button className="mt-2 w-full rounded-xl bg-lime-300 py-3.5 text-sm font-bold text-[#101512] transition hover:bg-lime-200">
        Create demo profile <ArrowRight size={16} className="ml-1 inline" />
      </button>
      <p className="pt-1 text-center text-[11px] text-slate-500">Just a demo — your details stay in this session.</p>
    </form>
  );
}

function SignupSuccess({ onEnter }) {
  return (
    <div className="text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-300/10 text-lime-300">
        <Check size={28} />
      </span>
      <p className="mt-5 text-sm leading-6 text-slate-300">
        Your demo profile is ready. The arena is warmed up and waiting for you.
      </p>
      <div className="mt-5 rounded-xl border border-white/[.08] bg-[#0b100f] p-4 text-left">
        <span className="text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">Next up</span>
        <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-white">
          <Swords size={16} className="text-lime-300" /> Find a skill-matched Code 
        </p>
      </div>
      <button
        onClick={onEnter}
        className="mt-5 w-full rounded-xl bg-lime-300 py-3.5 text-sm font-bold text-[#101512] transition hover:bg-lime-200"
      >
        Enter the lobby <ArrowRight size={16} className="ml-1 inline" />
      </button>
    </div>
  );
}

export default function AuthModal({ mode, signedUp, onClose, onLogin, onSignup, onSwitchToSignup, onEnterLobby }) {
  if (mode === "login") {
    return (
      <ModalShell title="Welcome back." eyebrow="Back in the arena" onClose={onClose}>
        <LoginForm onSubmit={onLogin} onSwitch={onSwitchToSignup} />
      </ModalShell>
    );
  }

  if (mode === "signup") {
    return (
      <ModalShell
        title={signedUp ? "You’re in the game." : "Find your next rival."}
        eyebrow={signedUp ? "Welcome to Code Arena" : "Your first Code  starts here"}
        onClose={onClose}
      >
        {signedUp ? <SignupSuccess onEnter={onEnterLobby} /> : <SignupForm onSubmit={onSignup} />}
      </ModalShell>
    );
  }

  return null;
}
