import { Link } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div
        data-tilt
        data-cursor="card"
        className="relative w-full max-w-md rounded-2xl border border-white/[.08] bg-[#1b1c1f]/95 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,.65)] backdrop-blur-xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary/20 bg-secondary/10 text-secondary">
          <Compass size={28} />
        </div>
        <span className="mt-5 block text-[10px] font-bold uppercase tracking-[.22em] text-secondary">
          Sector Unknown · 404
        </span>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-on-surface">
          Lost in the{" "}
          <span className="font-sans italic font-normal text-primary">
            arena.
          </span>
        </h1>
        <p className="mt-3 text-sm leading-6 text-on-surface-muted">
          The sector coordinates you requested do not exist or have been decommissioned.
        </p>
        <Link
          to="/"
          data-magnetic
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-[#261f18] transition hover:bg-primary"
        >
          Return to base <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
