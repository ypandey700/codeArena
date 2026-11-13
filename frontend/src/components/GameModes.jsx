import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GAME_MODES, MODE_COLORS } from "../data/gameModes";
import ModeIcon from "./ModeIcon";
import { useAuth } from "../context/AuthContext";

export default function GameModes({ activeMode, onSelectMode, onSignup }) {
  const { user, openSignup } = useAuth();
  const navigate = useNavigate();
  const mode = GAME_MODES[activeMode];
  const colors = MODE_COLORS[mode.color];

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
      id="modes"
      data-cursor-section="features"
      className="mx-auto max-w-7xl scroll-mt-8 px-5 pb-12 pt-8 sm:px-8 lg:px-10 lg:pb-28"
    >
      <div data-reveal className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.22em] text-primary">Pick your next challenge</p>
          <h2 className="text-xl font-semibold tracking-[-.045em] text-on-surface sm:text-2xl">
            Find your <span className="font-sans italic font-normal text-primary">game.</span>
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-on-surface-muted">
          From a quick practice round to a ranked Code , there’s more than one way to level up.
        </p>
      </div>

      <div data-reveal-stagger className="mt-8 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Coding game modes">
        {GAME_MODES.map((item, index) => (
          <button
            key={item.id}
            data-cursor="card"
            data-tilt
            type="button"
            role="tab"
            aria-selected={activeMode === index}
            onClick={() => onSelectMode(index)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition ${
              activeMode === index ? MODE_COLORS[item.color] : "border-white/[.08] bg-white/[.02] text-on-surface-muted hover:border-white/20 hover:text-on-surface"
            }`}
          >
            <ModeIcon name={item.icon} size={15} />
            {item.name}
          </button>
        ))}
      </div>

      <div className="mt-3 grid overflow-hidden rounded-2xl border border-white/[.08] bg-[#1b1c1f] md:grid-cols-[1fr_.8fr]">
        <div className="p-6 sm:p-8">
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.2em] ${colors}`}>
            Mode 0{activeMode + 1}
          </span>
          <div className="mt-3 flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${colors}`}>
              <ModeIcon name={mode.icon} size={20} />
            </span>
            <h3 className="text-base font-semibold text-on-surface">{mode.name}</h3>
          </div>
          <p className="mt-3 max-w-md text-sm leading-6 text-on-surface-muted">{mode.detail}</p>
          <button onClick={handleAction} className="mt-5 text-xs font-semibold text-primary transition hover:text-primary">
            Try this mode <ArrowRight size={14} className="ml-1 inline" />
          </button>
        </div>
        <div className="flex min-h-[170px] flex-col justify-center border-t border-white/[.07] bg-[#18191b] p-6 sm:p-8 md:border-l md:border-t-0">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[.16em] text-on-surface-subtle">Your round, at a glance</span>
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              READY
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[.07] bg-[#1b1c1f] p-4">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${colors}`}>
              <ModeIcon name={mode.icon} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-on-surface">{mode.name}</p>
              <p className="mt-1 text-[10px] text-on-surface-subtle">Challenge queued · 1 opponent</p>
            </div>
            <ArrowRight size={16} className="text-primary" />
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[.06]">
            <div key={mode.id} className="mode-progress h-full rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </section>
  );
}
