import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronDown, LogOut, Menu, Swords, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, openLogin, openSignup, logout } = useAuth();
  const [mobileNav, setMobileNav] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

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
  }, [location.pathname]);

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
    if (location.pathname !== "/") {
      navigate("/");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePlayClick = () => {
    setMobileNav(false);
    if (user) {
      navigate("/profile");
    } else {
      openSignup();
    }
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

  return (
    <header className="arena-navbar relative z-30 mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-7xl items-center justify-between rounded-2xl border border-transparent px-4 py-3 backdrop-blur-xl sm:mt-4 sm:px-6 lg:mt-5 lg:px-8">
      <a
        href="#home"
        onClick={handleLogoClick}
        className="flex items-center gap-2.5"
        aria-label="Code Arena home"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-300 text-[#101512]">
          <Swords size={21} strokeWidth={2.4} />
        </span>
        <span className="text-[19px] font-bold tracking-tight text-white">
          Code <span className="text-lime-300">Arena</span>
        </span>
      </a>

      <nav
        className={`${
          mobileNav
            ? "absolute left-4 right-4 top-[68px] flex flex-col rounded-2xl border border-white/10 bg-[#101816] p-4 shadow-xl"
            : "hidden"
        } items-center gap-7 md:static md:flex md:flex-row md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
      >
        <a
          onClick={(e) => handleScrollTo(e, "#modes")}
          className="cursor-pointer text-sm text-slate-400 transition hover:text-white"
          href="#modes"
        >
          Explore modes
        </a>
        <a
          onClick={(e) => handleScrollTo(e, "#how-it-works")}
          className="cursor-pointer text-sm text-slate-400 transition hover:text-white"
          href="#how-it-works"
        >
          How it works
        </a>

        <div className="flex w-full flex-col gap-3 pt-2 md:hidden">
          {user ? (
            <div className="flex flex-col gap-2 rounded-xl border border-white/[.08] bg-[#0b100f] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="h-8 w-8 rounded-full border border-lime-300/40 object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-300/20 text-xs font-bold uppercase text-lime-300">
                      {user.username.charAt(0)}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-white">{user.username}</span>
                </div>
                <span className="rounded border border-lime-300/20 bg-lime-300/10 px-2 py-0.5 font-mono text-xs text-lime-300">
                  {user.rating ?? 1200}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <Link
                  to={`/u/${user.username}`}
                  onClick={() => setMobileNav(false)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] py-2 text-xs font-medium text-slate-200"
                >
                  <User size={14} /> Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 py-2 text-xs font-medium text-rose-300"
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
                className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm"
              >
                Log in
              </button>
              <button
                onClick={handlePlayClick}
                className="flex-1 rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold text-[#101512]"
              >
                Let’s play
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="hidden items-center gap-3 md:flex">
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdown((prev) => !prev)}
              className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.03] py-1.5 pl-2 pr-3 transition hover:border-lime-300/40 hover:bg-white/[.06]"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="h-7 w-7 rounded-full border border-lime-300/40 object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-300/20 text-xs font-bold uppercase text-lime-300 font-mono">
                  {user.username.charAt(0)}
                </span>
              )}
              <span className="text-xs font-semibold text-white">{user.username}</span>
              <span className="rounded border border-lime-300/20 bg-lime-300/10 px-1.5 py-0.5 font-mono text-[11px] text-lime-300">
                {user.rating ?? 1200}
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {userDropdown && (
              <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-white/10 bg-[#101816] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,.6)] backdrop-blur-xl">
                <Link
                  to={`/u/${user.username}`}
                  onClick={() => setUserDropdown(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[.06] hover:text-lime-300"
                >
                  <User size={14} /> Profile
                </Link>
                <div className="my-1 border-t border-white/[.06]" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10"
                >
                  <LogOut size={14} /> Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              data-magnetic
              onClick={handleLoginClick}
              className="px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-sky-300"
            >
              Log in
            </button>
            <button
              data-magnetic
              onClick={handlePlayClick}
              className="rounded-xl bg-lime-300 px-5 py-2.5 text-sm font-bold text-[#101512] transition hover:bg-lime-200"
            >
              Let’s play <ArrowUpRight className="ml-1 inline" size={16} />
            </button>
          </>
        )}
      </div>

      <button
        className="rounded-lg p-2 text-slate-300 md:hidden"
        aria-label="Toggle navigation"
        aria-expanded={mobileNav}
        onClick={() => setMobileNav((open) => !open)}
      >
        {mobileNav ? <X size={21} /> : <Menu size={21} />}
      </button>
    </header>
  );
}
