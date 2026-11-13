import { useRef } from "react";

export default function BattleModes({ onQuickDuel }) {
  const frameRef = useRef(null);
  function connectModes() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
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
        onQuickDuel();
      } else {
        event.preventDefault();
        doc.querySelector(".mode-feedback")?.remove();
        const toast = doc.createElement("div");
        toast.className = "mode-feedback";
        toast.setAttribute("role", "status");
        const label = control.textContent.trim();
        toast.textContent = /debug/i.test(label) ? "Debug Blitz matchmaking is coming soon." : /sql/i.test(label) ? "SQL Clash matchmaking is coming soon." : "This feature is coming soon.";
        doc.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }
    });
    doc.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.code === "Space") && event.target.matches("[data-mode-card]")) {
        event.preventDefault(); selectCard(event.target); return;
      }
      if (event.code === "Space" && event.target === doc.body) {
        event.preventDefault(); onQuickDuel();
      }
    });
  }
  return <iframe ref={frameRef} src="/battle-modes.html" title="Code Arena battle modes" onLoad={connectModes} className="block h-[calc(100dvh-64px)] w-full border-0 bg-[#0d0f11]" />;
}
