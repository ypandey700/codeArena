import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function ModalShell({ title, eyebrow, onClose, children }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#050a09]/85 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative my-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#101816] p-6 shadow-[0_24px_100px_rgba(0,0,0,.65)] sm:p-8"
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-1 focus:ring-lime-300"
        >
          <X size={19} />
        </button>
        <div className="mb-6">
          <span className="text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">{eyebrow}</span>
          <h2 id="dialog-title" className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoginForm({ onSubmit, onSwitch, loading, error }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ identifier, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-[11px] font-medium text-orange-300">{error}</div>}
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-300">Username or Email</span>
        <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b100f] px-3.5 focus-within:border-lime-300/50">
          <Mail size={16} className="text-slate-500" />
          <input
            required
            autoFocus
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Username or email"
            className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </span>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-300">Password</span>
        <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b100f] px-3.5 focus-within:border-lime-300/50">
          <Lock size={16} className="text-slate-500" />
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-xl bg-lime-300 py-3.5 text-sm font-bold text-[#101512] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          "Entering the arena…"
        ) : (
          <>
            Log in to the arena <ArrowRight size={16} className="ml-1 inline" />
          </>
        )}
      </button>
      <p className="pt-1 text-center text-[11px] text-slate-500">
        Enter your credentials to access your arena profile.
      </p>
      <p className="text-center text-xs text-slate-400">
        New around here?{" "}
        <button type="button" onClick={onSwitch} className="font-semibold text-lime-300 hover:text-lime-200">
          Join the game
        </button>
      </p>
    </form>
  );
}

function SignupForm({ onSubmit, onSwitch, loading, error }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ username, email, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-[11px] font-medium text-orange-300">{error}</div>}
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-300">Username</span>
        <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b100f] px-3.5 focus-within:border-lime-300/50">
          <User size={16} className="text-slate-500" />
          <input
            required
            autoFocus
            minLength={3}
            maxLength={20}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. byteBard"
            className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </span>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-300">Email</span>
        <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b100f] px-3.5 focus-within:border-lime-300/50">
          <Mail size={16} className="text-slate-500" />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </span>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-slate-300">Password</span>
        <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b100f] px-3.5 focus-within:border-lime-300/50">
          <Lock size={16} className="text-slate-500" />
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-xl bg-lime-300 py-3.5 text-sm font-bold text-[#101512] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          "Entering the arena…"
        ) : (
          <>
            Create arena profile <ArrowRight size={16} className="ml-1 inline" />
          </>
        )}
      </button>
      <p className="pt-1 text-center text-[11px] text-slate-500">
        Choose a unique username and a password with at least 8 characters.
      </p>
      <p className="text-center text-xs text-slate-400">
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} className="font-semibold text-lime-300 hover:text-lime-200">
          Log in
        </button>
      </p>
    </form>
  );
}

export default function AuthModal() {
  const { authModal, closeAuthModal, openLogin, openSignup, login, register } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
  }, [authModal]);

  if (!authModal) return null;

  const handleLoginSubmit = async ({ identifier, password }) => {
    setError("");
    setSubmitting(true);
    try {
      await login(identifier, password);
      closeAuthModal();
      navigate("/profile");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignupSubmit = async ({ username, email, password }) => {
    setError("");
    setSubmitting(true);
    try {
      await register(username, email, password);
      closeAuthModal();
      navigate("/profile");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to create profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (authModal === "login") {
    return (
      <ModalShell title="Welcome back." eyebrow="Back in the arena" onClose={closeAuthModal}>
        <LoginForm
          onSubmit={handleLoginSubmit}
          onSwitch={openSignup}
          loading={submitting}
          error={error}
        />
      </ModalShell>
    );
  }

  if (authModal === "signup") {
    return (
      <ModalShell title="Find your next rival." eyebrow="Your duel starts here" onClose={closeAuthModal}>
        <SignupForm
          onSubmit={handleSignupSubmit}
          onSwitch={openLogin}
          loading={submitting}
          error={error}
        />
      </ModalShell>
    );
  }

  return null;
}
