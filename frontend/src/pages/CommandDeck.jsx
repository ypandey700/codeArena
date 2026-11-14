import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBattle } from "../context/BattleContext";
import api from "../services/api";

export default function CommandDeck({ onQuickDuel }) {
  const { user } = useAuth();
  const { joinQueue } = useBattle();
  const navigate = useNavigate();
  const frameRef = useRef(null);
  const [stats, setStats] = useState({ online: 0, inQueue: 0 });

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const res = await api.get("/arena/stats");
        if (res.data?.data && isMounted) {
          setStats(res.data.data);
        }
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleQueue = () => {
    joinQueue("ranked_1v1");
    onQuickDuel?.();
  };

  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const queueTexts = doc.querySelectorAll("strong");
    queueTexts.forEach((el) => {
      if (/in queue/i.test(el.textContent)) {
        el.textContent = `${stats.online} online • ${stats.inQueue} in queue`;
      }
    });
  }, [stats]);

  function connectDashboard() {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !user) return;

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

    doc.querySelectorAll("header [class*='font-mono']").forEach((element) => {
      if (/^480 RR$/.test(element.textContent.trim())) element.textContent = `${user.rating ?? 1200} RR`;
    });

    const queueTexts = doc.querySelectorAll("strong");
    queueTexts.forEach((el) => {
      if (/in queue/i.test(el.textContent)) {
        el.textContent = `${stats.online} online • ${stats.inQueue} in queue`;
      }
    });

    doc.querySelectorAll("button, a").forEach((btn) => {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes("create custom lobby") || text.includes("spectate") || btn.title === "Spectate Duel" || btn.title === "Spectate") {
        btn.classList.add("opacity-60");
      }
    });

    doc.addEventListener("click", (event) => {
      const control = event.target.closest("button, a, [data-path]");
      if (!control) return;
      const label = control.textContent.trim().replace(/\s+/g, " ");

      if (control.dataset.path === "battle-modes") {
        event.preventDefault();
        navigate("/battle-modes");
      } else if (control.dataset.path === "command-deck") {
        event.preventDefault();
        doc.defaultView.scrollTo({ top: 0, behavior: "smooth" });
      } else if (control.id === "queue-cta-btn" || /1v1 quick duel|challenge 1v1/i.test(label) || control.title === "Challenge 1v1") {
        event.preventDefault();
        handleQueue();
      } else if (/create custom lobby|spectate|squad/i.test(label) || control.title === "Spectate Duel" || control.title === "Spectate") {
        event.preventDefault();
        feedback("Coming soon.");
      } else if (control.classList.contains("runtime-btn")) {
      } else if (/solve in|view problem/i.test(label)) {
        event.preventDefault();
        navigate("/battle-modes");
      } else {
        event.preventDefault();
        feedback("Coming soon.");
      }
    });

    doc.addEventListener("keydown", (event) => {
      if (event.code === "Space" && event.target === doc.body) {
        event.preventDefault();
        handleQueue();
      }
    });

    const account = Array.from(doc.querySelectorAll("header *")).find(
      (element) => element.children.length === 0 && element.textContent.trim() === user.username
    );
    if (account) {
      const profileLink = doc.createElement("a");
      profileLink.href = `/u/${encodeURIComponent(user.username)}`;
      profileLink.textContent = user.username;
      profileLink.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        navigate(`/u/${user.username}`);
      });
      account.replaceChildren(profileLink);
    }
  }

  return (
    <iframe
      ref={frameRef}
      src="/command-deck.html"
      title="Code Arena command deck"
      onLoad={connectDashboard}
      className="block h-[calc(100dvh-64px)] w-full border-0 bg-[#0d0f11]"
    />
  );
}
