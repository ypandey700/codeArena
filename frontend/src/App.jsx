import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AuthModal from "./components/AuthModal";
import CursorEffects from "./components/CursorEffects";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollEffects from "./components/ScrollEffects";
import Landing from "./pages/Landing";
import AIInterview from "./pages/AIInterview";
import CommandDeck from "./pages/CommandDeck";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import { useAuth } from "./context/AuthContext";
import { MatchFound, QueueOverlay } from "./components/Matchmaking";
import BattleArena from "./components/BattleArena";
import PostMortemReport from "./components/PostMortemReport";

const BattleModes = lazy(() => import("./pages/BattleModes"));

function ProfileRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={`/u/${user.username}`} replace />;
}

export default function App() {
  const location = useLocation();
  const { user } = useAuth();
  const [duelState, setDuelState] = useState("closed");
  const isReferenceLanding = ["/", "/dashboard"].includes(location.pathname) && ["closed", "queue", "minimized"].includes(duelState);

  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth" });
        }, 80);
      }
    }
  }, [location.pathname, location.hash]);

  return (
    <main className={`flex min-h-screen flex-col justify-between overflow-x-hidden bg-[#18191b] text-on-surface selection:bg-primary selection:text-[#261f18] ${(isReferenceLanding && location.pathname === "/") || ["battle"].includes(duelState) ? "pt-0" : "pt-16"}`}>
      {!isReferenceLanding && <CursorEffects />}
      {!isReferenceLanding && <ScrollEffects />}
      {!(isReferenceLanding && location.pathname === "/") && !(["battle"].includes(duelState)) && <Navbar onQuickDuel={() => setDuelState("queue")} />}

      <div className="flex-1">
        {duelState === "report" ? (
          <PostMortemReport onBack={() => setDuelState("closed")} onReplay={() => setDuelState("battle")} onQueueNext={() => setDuelState("queue")} />
        ) : duelState === "battle" ? (
          <BattleArena onInterview={() => setDuelState("closed")} onExit={() => setDuelState("closed")} onQueueNext={() => setDuelState("queue")} onReport={() => setDuelState("report")} />
        ) : duelState === "found" ? (
          <MatchFound onClose={() => setDuelState("closed")} onAccepted={() => setDuelState("battle")} />
        ) : (
          <Routes>
            <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
            <Route path="/match-report" element={<ProtectedRoute><PostMortemReport onBack={() => setDuelState("closed")} onReplay={() => setDuelState("battle")} onQueueNext={() => setDuelState("queue")} /></ProtectedRoute>} />
            <Route path="/ai-interview" element={<ProtectedRoute><AIInterview /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><CommandDeck onQuickDuel={() => setDuelState("queue")} /></ProtectedRoute>} />
            <Route path="/battle-modes" element={<ProtectedRoute><Suspense fallback={<div className="min-h-screen bg-[#18191b]" />}><BattleModes onQuickDuel={() => setDuelState("queue")} /></Suspense></ProtectedRoute>} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfileRedirect />
                </ProtectedRoute>
              }
            />
            <Route path="/u/:username" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </div>

      {!isReferenceLanding && !["/battle-modes", "/match-report"].includes(location.pathname) && !(["battle", "report", "found"].includes(duelState)) && <footer className="w-full border-t border-white/[.05] bg-[#18191b] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-5 text-center sm:px-8 md:flex-row md:text-left lg:px-10">
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.12em] text-muted"><span className="h-2 w-2 rounded-full bg-primary" /> All Battle Clusters Nominal</div>
          <div className="flex flex-wrap justify-center gap-5 text-[9px] text-muted"><span>Terms</span><span>Privacy</span><span>Rules of Engagement</span><span>API Docs</span></div>
          <span className="text-[9px] text-muted">© 2025 Code Arena (AlgoWars). All rights reserved.</span>
        </div>
      </footer>}

      <AuthModal />
      {duelState === "queue" && (
        <QueueOverlay
          onFound={() => setDuelState("found")}
          onMinimize={() => setDuelState("minimized")}
          onClose={() => setDuelState("closed")}
        />
      )}
      {duelState === "minimized" && (
        <button
          onClick={() => setDuelState("queue")}
          className="fixed bottom-5 left-5 z-[70] flex items-center gap-3 rounded-lg border border-[#c5a17a]/40 bg-[#202124] px-4 py-3 text-left shadow-[0_12px_45px_rgba(0,0,0,.6)]"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#c5a17a]" />
          <span><span className="block text-xs font-bold tracking-wide text-[#c5a17a]">1V1 QUICK DUEL</span><span className="text-[11px] text-[#929196]">Searching for rival · Restore</span></span>
        </button>
      )}
    </main>
  );
}
