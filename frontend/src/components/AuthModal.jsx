import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Github, Lock, Mail, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Brand from "./Brand";

function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function OAuthButtons() {
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

  return (
    <div className="space-y-2.5">
      <a
        href={`${apiBase}/auth/google`}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-[#2c3850] bg-[#080c13] py-2.5 text-[13px] font-medium text-[#e4eaf5] transition hover:border-[#ffe76e] hover:bg-[#151b27]"
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </a>
      <a
        href={`${apiBase}/auth/github`}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-[#2c3850] bg-[#080c13] py-2.5 text-[13px] font-medium text-[#e4eaf5] transition hover:border-[#ffe76e] hover:bg-[#151b27]"
      >
        <Github size={16} />
        <span>Continue with GitHub</span>
      </a>
    </div>
  );
}

function Divider() {
  return (
    <div className="relative my-4 flex items-center justify-center">
      <div className="w-full border-t border-[#293449]" />
      <span className="absolute bg-[#10141d] px-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-subtle">
        or
      </span>
    </div>
  );
}

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
          <div className="mb-6"><Brand compact /></div>
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
      <OAuthButtons />
      <Divider />
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
      <OAuthButtons />
      <Divider />
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
