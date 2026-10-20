import { useState } from "react";
import { Swords } from "lucide-react";
import AuthModal from "./components/AuthModal";
import CursorEffects from "./components/CursorEffects";
import GameModes from "./components/GameModes";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Navbar from "./components/Navbar";
import ScrollEffects from "./components/ScrollEffects";

export default function App() {
  const [modal, setModal] = useState(null);
  const [signedUp, setSignedUp] = useState(false);
  const [activeMode, setActiveMode] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [battleStarted, setBattleStarted] = useState(false);

  function openLogin() {
    setModal("login");
    setMobileNav(false);
  }

  function openSignup() {
    setModal("signup");
    setMobileNav(false);
    setSignedUp(false);
  }

  function closeModal() {
    setModal(null);
    setSignedUp(false);
  }

  function handleLogin(event) {
    event.preventDefault();
    setModal(null);
    setBattleStarted(true);
  }

  function handleSignup(event) {
    event.preventDefault();
    setSignedUp(true);
  }

  function enterLobby() {
    setModal(null);
    setSignedUp(false);
    setBattleStarted(true);
    document.getElementById("home")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b100f] text-slate-100 selection:bg-lime-300 selection:text-[#0b100f]">
      <CursorEffects />
      <ScrollEffects />
      <Navbar
        mobileNav={mobileNav}
        onToggleNav={() => setMobileNav((open) => !open)}
        onCloseNav={() => setMobileNav(false)}
        onLogin={openLogin}
        onSignup={openSignup}
      />
      <Hero
        battleStarted={battleStarted}
        onSignup={openSignup}
        onToggleBattle={() => setBattleStarted((value) => !value)}
      />
      <GameModes activeMode={activeMode} onSelectMode={setActiveMode} onSignup={openSignup} />
      <HowItWorks onSignup={openSignup} />

      <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-7 sm:flex-row sm:px-8 lg:px-10">
        <a href="#home" className="flex items-center gap-2 text-sm font-bold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-300 text-[#101512]">
            <Swords size={16} />
          </span>
          Code <span className="-ml-2 text-lime-300">Arena</span>
        </a>
        <p className="text-xs text-slate-600">Made for the love of getting better at code.</p>
        <a href="#home" className="text-xs text-slate-500 transition hover:text-lime-300">
          Back to top ↑
        </a>
      </footer>

      <AuthModal
        mode={modal}
        signedUp={signedUp}
        onClose={closeModal}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onSwitchToSignup={openSignup}
        onEnterLobby={enterLobby}
      />
    </main>
  );
}
