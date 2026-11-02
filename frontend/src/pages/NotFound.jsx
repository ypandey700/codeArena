import { Link } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-20">
      <div
        data-tilt
        data-cursor="card"
        className="relative w-full max-w-md rounded-2xl border border-white/[.08] bg-[#111816]/95 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,.65)] backdrop-blur-xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-orange-300">
          <Compass size={28} />
        </div>
        <span className="mt-5 block text-[10px] font-bold uppercase tracking-[.22em] text-orange-300">
          Sector Unknown · 404
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Lost in the{" "}
          <span className="font-serif italic font-normal text-lime-300">
            arena.
          </span>
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          The sector coordinates you requested do not exist or have been decommissioned.
        </p>
        <Link
          to="/"
          data-magnetic
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-[#101512] transition hover:bg-lime-200"
        >
          Return to base <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
