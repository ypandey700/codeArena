import { ArrowRight, Code, Target, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const STEPS = [
  { n: "01", text: "Pick a mode", icon: Target, tone: "bg-lime-300/10 text-lime-300" },
  { n: "02", text: "Take on a rival", icon: Code, tone: "bg-sky-300/10 text-sky-300" },
  { n: "03", text: "Learn and level up", icon: Trophy, tone: "bg-violet-300/10 text-violet-300" },
];

export default function HowItWorks({ onSignup }) {
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
    <section id="how-it-works" data-cursor-section="games" className="border-y border-white/[.06] bg-[#0e1411] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">Easy to jump in</p>
            <h2 className="text-3xl font-semibold tracking-[-.045em] text-white">
              Three steps. <span className="font-serif italic font-normal text-lime-300">One more round.</span>
            </h2>
          </div>
          <div data-reveal-stagger className="grid gap-4 sm:grid-cols-3 md:max-w-[650px]">
            {STEPS.map((step) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={step.n}
                  data-cursor="card"
                  data-tilt
                  className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-4"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${step.tone}`}>
                    <StepIcon size={17} />
                  </span>
                  <span>
                    <span className="block text-[9px] font-mono text-slate-600">{step.n}</span>
                    <span className="mt-1 block text-xs font-medium text-slate-200">{step.text}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <button
            data-magnetic
            onClick={handleAction}
            className="shrink-0 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-[#101512] transition hover:bg-lime-200"
          >
            Start playing <ArrowRight size={16} className="ml-1 inline" />
          </button>
        </div>
      </div>
    </section>
  );
}
