import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import AuthModal from "./components/AuthModal";
import CursorEffects from "./components/CursorEffects";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollEffects from "./components/ScrollEffects";
import Landing from "./pages/Landing";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import { useAuth } from "./context/AuthContext";

function ProfileRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={`/u/${user.username}`} replace />;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

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

  const handleFooterHome = (e) => {
    e.preventDefault();
    if (location.pathname !== "/") {
      navigate("/");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <main className="flex min-h-screen flex-col justify-between overflow-x-hidden bg-[#0b100f] text-slate-100 selection:bg-lime-300 selection:text-[#0b100f]">
      <CursorEffects />
      <ScrollEffects />
      <Navbar />

      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
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
      </div>

      <footer className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-5 py-7 sm:flex-row sm:px-8 lg:px-10">
        <a
          href="#home"
          onClick={handleFooterHome}
          className="flex items-center gap-2 text-sm font-bold text-white"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-300 text-[#101512]">
            <Swords size={16} />
          </span>
          Code <span className="-ml-2 text-lime-300">Arena</span>
        </a>
        <p className="text-xs text-slate-600">Made for the love of getting better at code.</p>
        <a
          href="#home"
          onClick={handleFooterHome}
          className="text-xs text-slate-500 transition hover:text-lime-300"
        >
          Back to top ↑
        </a>
      </footer>

      <AuthModal />
    </main>
  );
}
