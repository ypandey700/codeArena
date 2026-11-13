import { useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PostMortemReport({ onBack, onReplay, onQueueNext }) {
  const frameRef = useRef(null);
  const { user } = useAuth();
  const { state } = useLocation();
  const navigate = useNavigate();
  function connectReport() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.parentElement.closest("script, style")) walker.currentNode.textContent = walker.currentNode.textContent.replaceAll("v0id_runner", user?.username || "You");
    }
    if (state?.answers?.length) {
      const section = doc.createElement("section");
      section.className = "mx-6 mb-8 rounded-lg border border-white/10 bg-surface-container p-5";
      const heading = doc.createElement("h2"); heading.textContent = "Your interview answers"; heading.className = "text-lg font-semibold mb-4";
      section.appendChild(heading);
      state.answers.forEach((answer, index) => {
        const text = doc.createElement("p"); text.textContent = `${index + 1}. ${answer}`; text.className = "mb-3 text-sm text-secondary whitespace-pre-wrap"; section.appendChild(text);
      });
      doc.querySelector("main").appendChild(section);
    }
    function feedback(message) {
      doc.querySelector(".report-feedback")?.remove();
      const toast = doc.createElement("div"); toast.className = "report-feedback"; toast.setAttribute("role", "status"); toast.textContent = message; doc.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }
    doc.addEventListener("click", async (event) => {
      const button = event.target.closest("button, a"); if (!button) return;
      const label = button.textContent.replace(/\s+/g, " ").trim(); event.preventDefault();
      if (/queue.*duel|queue.*next/i.test(label)) onQueueNext?.();
      else if (/export.*pdf/i.test(label)) doc.defaultView.print();
      else if (/share replay/i.test(label)) {
        try { await navigator.clipboard.writeText(`${window.location.origin}/match-report`); feedback("Report preview link copied."); }
        catch { feedback("Could not copy the link. Open /match-report to share the preview."); }
      } else if (/copy.*snippet/i.test(label)) {
        const snippet = doc.querySelector("pre");
        try { await navigator.clipboard.writeText(snippet?.textContent || ""); feedback("Example snippet copied."); } catch { feedback("Clipboard access was unavailable."); }
      } else if (/replay/i.test(label)) onReplay?.();
      else if (button.dataset.path === "command-deck") { if (onBack) onBack(); navigate("/dashboard"); }
      else if (button.dataset.path === "battle-modes") navigate("/battle-modes");
      else feedback("This action is not connected yet.");
    });
    doc.addEventListener("keydown", (event) => {
      if (/^(INPUT|TEXTAREA|BUTTON|A|SELECT)$/.test(event.target.tagName)) return;
      if (event.code === "Enter" || event.code === "Space") { event.preventDefault(); onQueueNext?.(); }
    });
  }
  return <iframe ref={frameRef} src="/match-report.html" title="Match post-mortem and code quality report" onLoad={connectReport} className="block h-[calc(100dvh-64px)] w-full border-0 bg-[#121414]" />;
}
