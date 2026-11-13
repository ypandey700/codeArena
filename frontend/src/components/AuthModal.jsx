import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Code2, Lock, Mail, User, X } from "lucide-react";
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
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="auth-refresh relative my-auto w-full max-w-[410px] rounded-xl border border-[#293449] bg-[#10141d] p-6 shadow-[0_24px_100px_rgba(0,0,0,.65)] sm:p-8"
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-2 text-on-surface-muted transition hover:bg-white/5 hover:text-on-surface focus:outline-none focus:ring-1 focus:ring-[#ffe76e]"
        >
          <X size={19} />
        </button>
        <div className="mb-7">
          <div className="mb-6 flex items-center gap-2 text-[#e4eaf5]"><span className="flex h-6 w-6 items-center justify-center rounded bg-[#e4eaf5] text-[#080c13]"><Code2 size={17} /></span><span className="text-sm font-semibold tracking-tight">codearena<span className="text-[#fddf49]">.</span></span></div>
          <span className="text-[11px] font-medium tracking-normal text-[#77c9d9]">{eyebrow}</span>
          <h2 id="dialog-title" className="mt-2 text-xl font-semibold tracking-tight text-on-surface">
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
      {error && <div role="alert" className="rounded-md border border-[#79464d] bg-[#40272c]/50 px-3 py-2.5 text-xs leading-5 text-[#efa4ad]">{error}</div>}
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-on-surface-muted">Username or Email</span>
        <span className="flex items-center gap-2 rounded-md border border-[#2c3850] bg-[#080c13] px-3 focus-within:border-[#ffe76e] focus-within:ring-1 focus-within:ring-[#ffe76e]/20 transition">
          <Mail size={16} className="text-on-surface-subtle" />
          <input
            required
            autoFocus
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Username or email"
            className="w-full bg-transparent py-2.5 text-[13px] text-on-surface outline-none placeholder:text-on-surface-subtle"
          />
        </span>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-on-surface-muted">Password</span>
        <span className="flex items-center gap-2 rounded-md border border-[#2c3850] bg-[#080c13] px-3 focus-within:border-[#ffe76e] focus-within:ring-1 focus-within:ring-[#ffe76e]/20 transition">
          <Lock size={16} className="text-on-surface-subtle" />
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="w-full bg-transparent py-2.5 text-[13px] text-on-surface outline-none placeholder:text-on-surface-subtle"
          />
        </span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-md bg-[#fddf49] py-3 text-[13px] font-semibold text-[#24200b] transition hover:bg-[#ffe76e] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          "Entering the arena…"
        ) : (
          <>
            Log in <ArrowRight size={16} className="ml-1 inline" />
          </>
        )}
      </button>
      <p className="pt-1 text-center text-[11px] text-on-surface-subtle">
        Enter your credentials to access your arena profile.
      </p>
      <p className="text-center text-xs text-on-surface-muted">
        New around here?{" "}
        <button type="button" onClick={onSwitch} className="font-medium text-[#ffe76e] hover:text-[#fff0a0]">
          Sign up
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
      {error && <div role="alert" className="rounded-md border border-[#79464d] bg-[#40272c]/50 px-3 py-2.5 text-xs leading-5 text-[#efa4ad]">{error}</div>}
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-on-surface-muted">Username</span>
        <span className="flex items-center gap-2 rounded-md border border-[#2c3850] bg-[#080c13] px-3 focus-within:border-[#ffe76e] focus-within:ring-1 focus-within:ring-[#ffe76e]/20 transition">
          <User size={16} className="text-on-surface-subtle" />
          <input
            required
            autoFocus
            minLength={3}
            maxLength={20}
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. byteBard"
            className="w-full bg-transparent py-2.5 text-[13px] text-on-surface outline-none placeholder:text-on-surface-subtle"
          />
        </span>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-on-surface-muted">Email</span>
        <span className="flex items-center gap-2 rounded-md border border-[#2c3850] bg-[#080c13] px-3 focus-within:border-[#ffe76e] focus-within:ring-1 focus-within:ring-[#ffe76e]/20 transition">
          <Mail size={16} className="text-on-surface-subtle" />
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-transparent py-2.5 text-[13px] text-on-surface outline-none placeholder:text-on-surface-subtle"
          />
        </span>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-on-surface-muted">Password</span>
        <span className="flex items-center gap-2 rounded-md border border-[#2c3850] bg-[#080c13] px-3 focus-within:border-[#ffe76e] focus-within:ring-1 focus-within:ring-[#ffe76e]/20 transition">
          <Lock size={16} className="text-on-surface-subtle" />
          <input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full bg-transparent py-2.5 text-[13px] text-on-surface outline-none placeholder:text-on-surface-subtle"
          />
        </span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-md bg-[#fddf49] py-3 text-[13px] font-semibold text-[#24200b] transition hover:bg-[#ffe76e] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          "Entering the arena…"
        ) : (
          <>
            Create account <ArrowRight size={16} className="ml-1 inline" />
          </>
        )}
      </button>
      <p className="pt-1 text-center text-[11px] text-on-surface-subtle">
        Choose a unique username and a password with at least 8 characters.
      </p>
      <p className="text-center text-xs text-on-surface-muted">
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} className="font-medium text-[#ffe76e] hover:text-[#fff0a0]">
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
      navigate("/dashboard");
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
      navigate("/dashboard");
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
