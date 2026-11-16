import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, AudioLines, CircleAlert, Code2, Eye, EyeOff, Github,
  LoaderCircle, LockKeyhole, Mail, Sparkles, Swords, User, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Brand from "./Brand";
import "./AuthModal.css";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

function ArenaPass() {
  return (
    <div className="auth-pass" aria-hidden="true">
      <span className="auth-pass__orbit auth-pass__orbit--outer" />
      <span className="auth-pass__orbit auth-pass__orbit--inner" />
      <div className="auth-pass__ticket">
        <div className="auth-pass__ticket-top"><span>THE ARENA</span><ArrowRight size={15} /></div>
        <div className="auth-pass__symbol"><Code2 size={57} strokeWidth={1.3} /><span /></div>
        <div className="auth-pass__ticket-bottom"><span>PLAYER ACCESS</span><span className="auth-pass__barcode" /></div>
      </div>
      <span className="auth-pass__spark auth-pass__spark--one"><Sparkles size={19} strokeWidth={1.3} /></span>
      <span className="auth-pass__spark auth-pass__spark--two">+</span>
      <span className="auth-pass__caption">YOUR NEXT MOVE IS WAITING</span>
    </div>
  );
}

function ModalShell({ mode, onClose, onLogin, onSignup, loading, children }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(document.activeElement);
  const signingUp = mode === "signup";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector("input")?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const elements = Array.from(dialogRef.current.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), [tabindex="0"]')).filter((element) => element.getClientRects().length);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) return;
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div className="auth-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" aria-describedby="auth-dialog-description" ref={dialogRef}>
        <button type="button" className="auth-close" aria-label="Close dialog" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        <aside className="auth-story arena-page-background">
          <Brand compact />
          <div className="auth-story__copy"><p className="auth-eyebrow"><span />THE NEXT CHAPTER</p><h2>{signingUp ? <>Every great<br />rivalry starts<br /><em>with you.</em></> : <>Your next<br />breakthrough<br /><em>starts here.</em></>}</h2><p>Bring your code. Back your thinking.<br />Come back a little sharper.</p></div>
          <ArenaPass />
          <div className="auth-story__journey"><span><Code2 size={13} />Code</span><ArrowRight size={11} /><span><AudioLines size={13} />Explain</span><ArrowRight size={11} /><span><Sparkles size={13} />Grow</span></div>
        </aside>
        <div className="auth-entry">
          <div className="auth-entry__brand"><Brand compact /></div>
          <div className="auth-mode" aria-label="Account access"><button type="button" aria-pressed={!signingUp} disabled={loading} onClick={onLogin}>Sign in</button><button type="button" aria-pressed={signingUp} disabled={loading} onClick={onSignup}>Create account</button></div>
          <div className="auth-entry__heading"><p className="auth-eyebrow"><span />{signingUp ? "YOUR FIRST MOVE" : "PLAYER ACCESS"}</p><h2 id="auth-dialog-title">{signingUp ? "Your story starts here." : "Welcome back."}</h2><p id="auth-dialog-description">{signingUp ? "One account. Your whole arena." : "Your next rival is out there. Let's get you in."}</p></div>
          {children}
          <div className="auth-entry__footer"><Swords size={12} aria-hidden="true" /><span>A little better. Every battle.</span></div>
        </div>
      </div>
    </div>, document.body,
  );
}

function OAuthButtons() {
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
  return (
    <div className="auth-oauth">
      <a href={`${apiBase}/auth/google`} aria-label="Continue with Google"><GoogleIcon /><span>Google</span></a>
      <a href={`${apiBase}/auth/github`} aria-label="Continue with GitHub"><Github size={17} aria-hidden="true" /><span>GitHub</span></a>
    </div>
  );
}

function AuthField({ label, icon: Icon, password = false, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field"><label htmlFor={inputProps.id}>{label}</label><div className="auth-field__input"><Icon size={16} aria-hidden="true" /><input {...inputProps} type={password ? visible ? "text" : "password" : inputProps.type || "text"} />{password && <button type="button" className="auth-password-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} disabled={inputProps.disabled}>{visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>}</div></div>
  );
}

function FormError({ message }) {
  return message ? <div className="auth-error" role="alert" id="auth-form-error"><CircleAlert size={15} aria-hidden="true" /><span>{message}</span></div> : null;
}

function SubmitButton({ loading, signup = false }) {
  return <button type="submit" className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle size={17} className="auth-spinner" aria-hidden="true" />{signup ? "Creating your player card…" : "Entering the arena…"}</> : <><span>{signup ? "Create my player card" : "Back to the arena"}</span><ArrowRight size={17} aria-hidden="true" /></>}</button>;
}

function LoginForm({ onSubmit, onSwitch, loading, error }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form className="auth-form" aria-busy={loading} onSubmit={(event) => { event.preventDefault(); if (!loading) onSubmit({ identifier, password }); }}>
      <OAuthButtons />
      <div className="auth-divider"><span>or continue with your account</span></div>
      <FormError message={error} />
      <AuthField id="auth-identifier" name="username" label="Username or email" icon={User} autoComplete="username" required autoFocus placeholder="Your username or email" value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={loading} aria-invalid={!!error} aria-describedby={error ? "auth-form-error" : undefined} />
      <AuthField id="auth-password" name="password" label="Password" icon={LockKeyhole} autoComplete="current-password" required password placeholder="Your password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} aria-invalid={!!error} aria-describedby={error ? "auth-form-error" : undefined} />
      <SubmitButton loading={loading} />
      <p className="auth-switch">New to the arena? <button type="button" onClick={onSwitch} disabled={loading}>Create an account <ArrowRight size={11} aria-hidden="true" /></button></p>
    </form>
  );
}

function SignupForm({ onSubmit, onSwitch, loading, error }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form className="auth-form" aria-busy={loading} onSubmit={(event) => { event.preventDefault(); if (!loading) onSubmit({ username, email, password }); }}>
      <OAuthButtons />
      <div className="auth-divider"><span>or make it yours</span></div>
      <FormError message={error} />
      <AuthField id="auth-username" name="username" label="Username" icon={User} autoComplete="username" required autoFocus minLength={3} maxLength={20} placeholder="Choose your arena name" value={username} onChange={(event) => setUsername(event.target.value)} disabled={loading} aria-invalid={!!error} aria-describedby={error ? "auth-form-error" : undefined} />
      <AuthField id="auth-email" name="email" label="Email" icon={Mail} type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} aria-invalid={!!error} aria-describedby={error ? "auth-form-error" : undefined} />
      <AuthField id="auth-password" name="password" label="Password" icon={LockKeyhole} autoComplete="new-password" required minLength={8} password placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} aria-invalid={!!error} aria-describedby={error ? "auth-password-hint auth-form-error" : "auth-password-hint"} />
      <p className="auth-field-hint" id="auth-password-hint">Your password needs at least 8 characters.</p>
      <SubmitButton loading={loading} signup />
      <p className="auth-switch">Already a challenger? <button type="button" onClick={onSwitch} disabled={loading}>Sign in <ArrowRight size={11} aria-hidden="true" /></button></p>
    </form>
  );
}

export default function AuthModal() {
  const { authModal, closeAuthModal, openLogin, openSignup, login, register } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setError(""); }, [authModal]);
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

  return <ModalShell mode={authModal} onClose={closeAuthModal} onLogin={openLogin} onSignup={openSignup} loading={submitting}>{authModal === "login" ? <LoginForm onSubmit={handleLoginSubmit} onSwitch={openSignup} loading={submitting} error={error} /> : <SignupForm onSubmit={handleSignupSubmit} onSwitch={openLogin} loading={submitting} error={error} />}</ModalShell>;
}
