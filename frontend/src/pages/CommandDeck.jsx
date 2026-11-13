import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function CommandDeck({ onQuickDuel }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const frameRef = useRef(null);

  function connectDashboard() {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !user) return;
    // Replace template identity using text nodes, never interpolated HTML.
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest("script, style")) continue;
      node.textContent = node.textContent.replaceAll("v0id_runner", user.username);
    }
    function feedback(message) {
      doc.querySelector(".command-feedback")?.remove();
      const toast = doc.createElement("div");
      toast.className = "command-feedback";
      toast.setAttribute("role", "status");
      toast.textContent = message;
      doc.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4500);
    }
    // The supplied performance cards remain illustrative until battle history is connected.
    doc.querySelectorAll("header [class*='font-mono']").forEach((element) => {
      if (/^480 RR$/.test(element.textContent.trim())) element.textContent = `${user.rating ?? 1200} RR`;
    });
    doc.addEventListener("click", (event) => {
      const control = event.target.closest("button, a, [data-path]");
      if (!control) return;
      const label = control.textContent.trim().replace(/\s+/g, " ");
      if (control.dataset.path === "battle-modes") {
        event.preventDefault(); navigate("/battle-modes");
      } else if (control.dataset.path === "command-deck") {
        event.preventDefault(); doc.defaultView.scrollTo({ top: 0, behavior: "smooth" });
      } else if (control.id === "queue-cta-btn" || /1v1 quick duel|challenge 1v1/i.test(label) || control.title === "Challenge 1v1") {
        event.preventDefault(); onQuickDuel();
      } else if (control.classList.contains("runtime-btn")) {
        // The template's runtime selection listener handles this control.
      } else if (/solve in|view problem/i.test(label)) {
        event.preventDefault(); navigate("/battle-modes");
      } else {
        event.preventDefault(); feedback("This feature is coming soon. You can start a quick duel or browse battle modes.");
      }
    });
    doc.addEventListener("keydown", (event) => {
      if (event.code === "Space" && event.target === doc.body) {
        event.preventDefault(); onQuickDuel();
      }
    });
    const account = Array.from(doc.querySelectorAll("header *")).find((element) => element.children.length === 0 && element.textContent.trim() === user.username);
    if (account) {
      const profileLink = doc.createElement("a");
      profileLink.href = `/u/${encodeURIComponent(user.username)}`;
      profileLink.textContent = user.username;
      profileLink.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); navigate(`/u/${user.username}`); });
      account.replaceChildren(profileLink);
    }
  }

  return <iframe ref={frameRef} src="/command-deck.html" title="Code Arena command deck" onLoad={connectDashboard} className="block h-[calc(100dvh-64px)] w-full border-0 bg-[#0d0f11]" />;
}
