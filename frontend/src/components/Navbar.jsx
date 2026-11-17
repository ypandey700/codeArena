import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Bell, LogOut, Menu, Swords, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Brand from "./Brand";
import RankOverview, { RankBadge } from "./RankOverview";

export default function Navbar({ onQuickDuel, matchFound = false }) {
  const { user, openLogin, openSignup, logout } = useAuth();
  const [mobileNav, setMobileNav] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const dropdownRef = useRef(null);
  const rankReturnFocusRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isBattleModesPage = location.pathname === "/battle-modes";
  const isProfilePage = location.pathname === "/profile" || location.pathname.startsWith("/u/");

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileNav(false);
    setUserDropdown(false);
    setRankOpen(false);
  }, [location.pathname, matchFound]);

  const handleScrollTo = (e, hash) => {
    e.preventDefault();
    setMobileNav(false);
    if (location.pathname !== "/") {
      navigate(`/${hash}`);
    } else {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const handleLogoClick = (e) => {
    e.preventDefault();
    setMobileNav(false);
    if (user) {
      if (location.pathname !== "/dashboard") navigate("/dashboard");
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (location.pathname !== "/") {
      navigate("/");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleArenaClick = (e) => {
    e.preventDefault();
    setMobileNav(false);
    navigate("/battle-modes");
  };

  const handlePlayClick = () => {
    setMobileNav(false);
    if (user) {
      navigate("/profile");
    } else {
      openSignup();
    }
  };

  const handleQuickDuel = () => {
    setMobileNav(false);
    if (user) onQuickDuel?.();
    else openLogin();
  };

  const handleLoginClick = () => {
    setMobileNav(false);
    openLogin();
  };

  const handleLogout = async () => {
    setUserDropdown(false);
    setMobileNav(false);
    await logout();
    navigate("/");
  };

  const openRanks = (event) => {
    rankReturnFocusRef.current = event.currentTarget.closest('[aria-label="Account menu"]')
      ? dropdownRef.current?.querySelector('button[aria-label="Open account menu"]')
      : event.currentTarget;
    setUserDropdown(false);
    setRankOpen(true);
  };

  if (user) {
    return (
      <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[.08] bg-[#0d0f11]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-5"><Link to="/dashboard" className="flex items-center gap-2.5"><Brand /></Link><nav aria-label="Account navigation" className="hidden items-center gap-1 md:flex">{[{ path: "/dashboard", label: "Command Deck" }, { path: "/battle-modes", label: "Battle Modes" }, { path: "/skiller", label: "Skiller" }].map((item) => <Link key={item.path} to={item.path} aria-current={(location.pathname === item.path || (item.path === "/skiller" && location.pathname.startsWith("/skiller/"))) ? "page" : undefined} className={`rounded-md border-b-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${(location.pathname === item.path || (item.path === "/skiller" && location.pathname.startsWith("/skiller/"))) ? "border-[#fddf49] bg-white/[.06] text-[#fddf49]" : "border-transparent text-[#9298a5] hover:bg-white/5 hover:text-white"}`}>{item.label}</Link>)}</nav></div>
          {matchFound ? <span className="flex shrink-0 items-center gap-2 rounded-md border border-[#fddf49]/20 bg-[#fddf49]/5 px-3 py-2 text-[10px] font-semibold text-[#e5d584]"><Swords size={13} aria-hidden="true" /><span className="hidden sm:inline">DUEL READY</span><span className="sm:hidden">READY</span></span> : <button onClick={handleQuickDuel} className="flex shrink-0 items-center gap-2 rounded-lg bg-[#fddf49] px-3 py-2 text-[11px] font-bold text-[#211c08] shadow-[0_0_18px_#fddf4920] hover:bg-[#ffe76e]"><Swords size={14} /><span className="hidden sm:inline">1V1 QUICK DUEL</span><span className="sm:hidden">DUEL</span></button>}
          <div className="flex items-center gap-3">
            <RankBadge user={user} onClick={openRanks} expanded={rankOpen} />
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setUserDropdown((open) => !open)} aria-label="Open account menu" aria-expanded={userDropdown} className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-[#fddf49]/70 bg-[#1f2328] text-[#fddf49]">{user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : <User size={17} />}</span><span className="hidden text-left sm:block"><b className="block max-w-28 truncate text-xs text-white">{user.username}</b><span className="text-[10px] text-emerald-400">Online</span></span></button>
              {userDropdown && <nav aria-label="Account menu" className="absolute right-0 top-full mt-3 w-48 rounded-lg border border-white/10 bg-[#16191c] p-2 shadow-xl"><Link to="/dashboard" className="block rounded px-3 py-2 text-xs text-[#d0d4df] hover:bg-white/5">Command Deck</Link><Link to="/battle-modes" className="block rounded px-3 py-2 text-xs text-[#d0d4df] hover:bg-white/5">Battle Modes</Link><Link to="/skiller" className="block rounded px-3 py-2 text-xs text-[#d0d4df] hover:bg-white/5">Skiller</Link><Link to={`/u/${user.username}`} className="block rounded px-3 py-2 text-xs text-[#d0d4df] hover:bg-white/5">My profile</Link><button type="button" onClick={openRanks} aria-haspopup="dialog" className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-[#e5d889] hover:bg-white/5">Your rank <ArrowUpRight size={13} aria-hidden="true" /></button><button onClick={handleLogout} className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-[#e29a9a] hover:bg-white/5"><LogOut size={13} />Log out</button></nav>}
            </div>
          </div>
        </div>
      </header>
      {rankOpen && <RankOverview user={user} onClose={() => setRankOpen(false)} returnFocusTo={rankReturnFocusRef.current} />}
      </>
    );
  }

  if (!user && location.pathname === "/" && !matchFound) {
    return (
      <header className="reference-navbar fixed inset-x-0 top-0 z-50 border-b border-white/[.08] bg-[#080a0e]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-10">
          <a href="#home" onClick={handleLogoClick} aria-label="Code Arena home" className="flex shrink-0 items-center gap-2.5"><Brand /></a>
          <nav aria-label="Main navigation" className="ml-auto hidden items-center gap-7 md:flex">
            <a href="#features" onClick={(event) => handleScrollTo(event, "#features")} className="text-[13px] text-[#b2afb7] transition hover:text-white">Overview</a>
            <a href="#modes" onClick={(event) => handleScrollTo(event, "#modes")} className="text-[13px] text-[#b2afb7] transition hover:text-white">Protocols</a>
            <button onClick={handleLoginClick} className="text-[13px] text-[#b2afb7] transition hover:text-white">Log in</button>
            <button onClick={handlePlayClick} className="h-9 rounded-md bg-[#ff633b] px-4 text-[13px] font-semibold text-[#16110e] transition hover:bg-[#ff805e]">Find 1v1 Match</button>
          </nav>
          <button onClick={() => setMobileNav((open) => !open)} aria-label="Toggle navigation" aria-expanded={mobileNav} aria-controls="landing-mobile-nav" className="rounded-md p-2 text-[#d9d6de] md:hidden">{mobileNav ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
        {mobileNav && <nav id="landing-mobile-nav" aria-label="Mobile navigation" className="flex flex-col gap-1 border-t border-white/10 bg-[#18181c] px-5 py-4 md:hidden"><a href="#features" onClick={(event) => handleScrollTo(event, "#features")} className="rounded-md px-3 py-2.5 text-sm text-[#c3bfc9] hover:bg-white/5">Overview</a><a href="#modes" onClick={(event) => handleScrollTo(event, "#modes")} className="rounded-md px-3 py-2.5 text-sm text-[#c3bfc9] hover:bg-white/5">Protocols</a><button onClick={handleLoginClick} className="rounded-md px-3 py-2.5 text-left text-sm text-[#c3bfc9] hover:bg-white/5">Log in</button><button onClick={handlePlayClick} className="mt-2 rounded-md bg-[#ff633b] px-3 py-2.5 text-sm font-semibold text-[#16110e] hover:bg-[#ff805e]">Find 1v1 Match</button></nav>}
      </header>
    );
  }

  return (
    <header className={`arena-navbar fixed inset-x-0 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-8 ${isBattleModesPage ? "arena-navbar-codechef top-0 h-16" : user && !matchFound ? "arena-navbar-auth top-1 mx-1 h-14 rounded-md border border-white/10 shadow-sm" : matchFound ? "top-0 h-20 border-b border-white/[.06]" : "top-0 h-16"}`}>
      <a
        href="#home"
        onClick={handleLogoClick}
        className="flex items-center gap-2"
        aria-label="Code Arena home"
      >
        <Brand />
      </a>

      <nav
        className={`${
          mobileNav
            ? "absolute left-4 right-4 top-[68px] flex flex-col rounded-md border border-white/10 bg-[#261f18] p-4 shadow-xl"
            : "hidden"
        } items-center gap-7 lg:static lg:flex lg:flex-row lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
      >
        {matchFound ? (
          <>
            <a onClick={(e) => handleScrollTo(e, "#features")} className="cursor-pointer text-sm font-semibold text-on-surface-muted transition hover:text-primary" href="#features">Features</a>
            <a onClick={(e) => handleScrollTo(e, "#modes")} className="cursor-pointer text-sm font-semibold text-on-surface-muted transition hover:text-primary" href="#modes">Battle Modes</a>
            <a onClick={(e) => handleScrollTo(e, "#live-preview")} className="cursor-pointer rounded-sm bg-[#2a2b2e] px-3 py-2 text-sm font-semibold text-[#c5a17a]" href="#live-preview">Esports Arena</a>
            <a onClick={(e) => handleScrollTo(e, "#stats")} className="cursor-pointer text-sm font-semibold text-on-surface-muted transition hover:text-primary" href="#stats">Leaderboards</a>
            <a onClick={(e) => handleScrollTo(e, "#features")} className="cursor-pointer text-sm font-semibold text-on-surface-muted transition hover:text-primary" href="#features">Documentation</a>
          </>
        ) : user ? (
          isBattleModesPage || isProfilePage ? (
            null
          ) : (
            <>
              <a onClick={handleArenaClick} className="cursor-pointer rounded-sm px-3 py-2 text-xs font-semibold text-on-surface-muted transition hover:bg-[#2a2b2e] hover:text-white" href="/battle-modes">Arena</a>
              <a onClick={(e) => handleScrollTo(e, "#modes")} className="cursor-pointer text-xs font-semibold text-on-surface-muted transition hover:text-primary" href="#modes">Battle Modes</a>
              <a onClick={(e) => handleScrollTo(e, "#live-preview")} className="cursor-pointer text-xs font-semibold text-on-surface-muted transition hover:text-primary" href="#live-preview">Esports Arena</a>
              <a onClick={(e) => handleScrollTo(e, "#stats")} className="cursor-pointer text-xs font-semibold text-on-surface-muted transition hover:text-primary" href="#stats">Leaderboards</a>
            </>
          )
        ) : (
          <>
            <a onClick={(e) => handleScrollTo(e, "#features")} className="cursor-pointer text-sm font-medium text-primary transition hover:text-on-surface" href="#features">Features</a>
            <a onClick={(e) => handleScrollTo(e, "#modes")} className="cursor-pointer text-sm font-medium text-on-surface-muted transition hover:text-primary" href="#modes">Battle Modes</a>
            <a onClick={(e) => handleScrollTo(e, "#live-preview")} className="cursor-pointer text-sm font-medium text-on-surface-muted transition hover:text-primary" href="#live-preview">Esports Arena</a>
            <a onClick={(e) => handleScrollTo(e, "#stats")} className="cursor-pointer text-sm font-medium text-on-surface-muted transition hover:text-primary" href="#stats">Leaderboards</a>
            <a onClick={(e) => handleScrollTo(e, "#features")} className="cursor-pointer text-sm font-medium text-on-surface-muted transition hover:text-primary" href="#features">Documentation</a>
          </>
        )}

        <div className="flex w-full flex-col gap-3 pt-2 lg:hidden">
          {user ? (
            <div className="flex flex-col gap-2 rounded-xl border border-white/[.08] bg-[#18191b] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="h-8 w-8 rounded-full border border-primary/40 object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold uppercase text-primary">
                      {user.username.charAt(0)}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-on-surface">{user.username}</span>
                </div>
                <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                  {user.rating ?? 1200}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <Link
                  to={`/u/${user.username}`}
                  onClick={() => setMobileNav(false)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] py-2 text-xs font-medium text-on-surface-muted"
                >
                  <User size={14} /> Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-on-surface-muted/20 bg-on-surface-muted/10 py-2 text-xs font-medium text-on-surface-muted"
                >
                  <LogOut size={14} /> Log out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex w-full gap-3">
              <button
                data-magnetic
                onClick={handleLoginClick}
                className="flex-1 rounded-full border border-white/10 px-4 py-2.5 text-sm"
              >
                Log in
              </button>
              <button
                onClick={handlePlayClick}
                className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-[#261f18]"
              >
                Enter Arena Free
              </button>
            </div>
          )}
          <button
            onClick={handleQuickDuel}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-bold text-[#261f18]"
          ><Swords size={16} /> 1v1 Quick Duel</button>
        </div>
      </nav>

      <div className="hidden items-center gap-3 lg:flex">
        {matchFound && user ? (
          <>
            <span className="flex items-center gap-2 rounded-md border border-white/[.06] bg-[#191a1c] px-3 py-1.5 text-xs font-bold text-[#c5a17a]"><span className="h-2 w-2 rounded-full bg-[#c5a17a]" />{Number(user.rating ?? 2480).toLocaleString()} MMR</span>
            <div className="relative" ref={dropdownRef}>
              <button aria-label="Open account menu" onClick={() => setUserDropdown((prev) => !prev)} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white text-[#261f18]">{user.avatar ? <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" /> : <User size={19} />}</button>
              {userDropdown && <div className="absolute right-0 top-full mt-2 w-44 rounded-md border border-white/10 bg-[#18191b] p-1.5 shadow-xl"><Link to={`/u/${user.username}`} onClick={() => setUserDropdown(false)} className="flex items-center gap-2 rounded px-3 py-2 text-xs text-on-surface-muted hover:bg-white/[.06]"><User size={14} />Profile</Link><button onClick={handleLogout} className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-on-surface-muted hover:bg-white/[.06]"><LogOut size={14} />Log out</button></div>}
            </div>
          </>
        ) : user ? (
          <>
            <span className="flex items-center gap-2 rounded-md border border-white/[.06] bg-[#191a1c] px-3 py-1.5 text-[9px] font-semibold text-[#929196]"><span className="text-[8px]">ARENA RATING</span><b className="text-primary">{Number(user.rating ?? 1200).toLocaleString()} MMR</b></span>
            <button onClick={handleQuickDuel} className="flex h-9 items-center gap-1.5 rounded-sm bg-primary px-3 text-[10px] font-semibold text-[#261f18] transition hover:bg-[#d3b18c]"><Swords size={14} /> 1v1 QUICK DUEL</button>
            <button aria-label="Notifications" className="relative rounded-sm bg-[#2a2b2e] p-2 text-[#b6b6b6] hover:text-primary"><Bell size={16} /><span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" /></button>
            <div className="relative" ref={dropdownRef}>
              <button aria-label="Open account menu" onClick={() => setUserDropdown((prev) => !prev)} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary/60 bg-[#2a2b2e] text-primary transition hover:border-primary">
                {user.avatar ? <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" /> : <span className="font-mono text-sm font-bold">{user.username.charAt(0).toUpperCase()}</span>}
              </button>
              {userDropdown && <div className="absolute right-0 top-full mt-2 w-44 rounded-md border border-white/10 bg-[#18191b] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,.6)]"><Link to={`/u/${user.username}`} onClick={() => setUserDropdown(false)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-on-surface-muted hover:bg-white/[.06] hover:text-primary"><User size={14} />Profile</Link><button onClick={handleLogout} className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-on-surface-muted hover:bg-white/[.06]"><LogOut size={14} />Log out</button></div>}
            </div>
          </>
        ) : (
          <>
            <button onClick={handleQuickDuel} className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-[#261f18] transition hover:bg-[#d3b18c]"><Swords size={16} /> 1v1 Quick Duel</button>
            <button
              data-magnetic
              onClick={handleLoginClick}
              className="h-[50px] rounded-full px-4 py-2 text-sm font-medium text-on-surface transition hover:text-primary"
            >
              Log in
            </button>
            <button
              data-magnetic
              onClick={handlePlayClick}
              className="h-[50px] rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-[#261f18] transition hover:bg-[#d3b18c]"
            >
              Enter Arena Free <ArrowUpRight className="ml-1 inline" size={16} />
            </button>
          </>
        )}
      </div>

      <button
        className="rounded-lg p-2 text-on-surface-muted lg:hidden"
        aria-label="Toggle navigation"
        aria-expanded={mobileNav}
        onClick={() => setMobileNav((open) => !open)}
      >
        {mobileNav ? <X size={21} /> : <Menu size={21} />}
      </button>
    </header>
  );
}
