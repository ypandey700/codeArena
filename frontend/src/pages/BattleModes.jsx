import { useRef } from "react";
import { useBattle } from "../context/BattleContext";

export default function BattleModes({ onQuickDuel }) {
  const frameRef = useRef(null);
  const { joinQueue } = useBattle();

  const handleQueue = () => {
    joinQueue("ranked_1v1");
    onQuickDuel?.();
  };

  function connectModes() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    doc.querySelectorAll('[data-mode-card="1"], [data-mode-card="2"]').forEach((card) => {
      card.classList.add("opacity-60");
      const btn = card.querySelector("button");
      if (btn) {
        btn.disabled = true;
        btn.classList.add("opacity-50", "cursor-not-allowed");
        const span = btn.querySelector("span:last-child");
        if (span) span.textContent = "Coming soon";
      }
    });

    function selectCard(card) {
      if (!card) return;
      doc.querySelectorAll("[data-mode-card]").forEach((item) => item.setAttribute("aria-current", String(item === card)));
    }

    doc.addEventListener("click", (event) => {
      selectCard(event.target.closest("[data-mode-card]"));
      const control = event.target.closest("button, a");
      if (!control) return;

      if (control.id === "queue-ranked-duel") {
        event.preventDefault();
        handleQueue();
      } else {
        event.preventDefault();
        doc.querySelector(".mode-feedback")?.remove();
        const toast = doc.createElement("div");
        toast.className = "mode-feedback";
        toast.setAttribute("role", "status");
        const label = control.textContent.trim();
        toast.textContent = /debug/i.test(label)
          ? "Debug Blitz is coming soon."
          : /sql/i.test(label)
          ? "SQL Clash is coming soon."
          : "Coming soon.";
        doc.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }
    });

    doc.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.code === "Space") && event.target.matches("[data-mode-card]")) {
        event.preventDefault();
        selectCard(event.target);
        return;
      }
      if (event.code === "Space" && event.target === doc.body) {
        event.preventDefault();
        handleQueue();
      }
    });
  }

  return (
    <iframe
      ref={frameRef}
      src="/battle-modes.html"
      title="Code Arena battle modes"
      onLoad={connectModes}
      className="block h-[calc(100dvh-64px)] w-full border-0 bg-[#0d0f11]"
    />
  );
}
