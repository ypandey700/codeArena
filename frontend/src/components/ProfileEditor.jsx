import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CircleAlert, LoaderCircle, Pencil, X } from "lucide-react";
import api from "../services/api";
import { PlayerAvatar } from "./ProfileDashboard";

export default function ProfileEditor({ profileUser, onClose, onUpdated }) {
  const [username, setUsername] = useState(profileUser.username || "");
  const [bio, setBio] = useState(profileUser.bio || "");
  const [college, setCollege] = useState(profileUser.college || "");
  const [avatar, setAvatar] = useState(profileUser.avatar || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const triggerRef = useRef(document.activeElement);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector("#pp-edit-username")?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
    };
  }, []);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3 || cleanUsername.length > 20) { setError("Username must be between 3 and 20 characters."); return; }
    setSaving(true);
    setError("");
    try {
      const response = await api.patch("/users/me", { username: cleanUsername, bio: bio.trim(), college: college.trim(), avatar: avatar.trim() });
      await onUpdated(response.data.data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Your profile couldn't be saved. Please try again.");
    } finally { setSaving(false); }
  }

  function keepFocusInEditor(event) {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]')).filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return createPortal(
    <dialog ref={dialogRef} className="player-editor" aria-labelledby="pp-edit-title" aria-describedby="pp-edit-description" onKeyDown={keepFocusInEditor} onCancel={(event) => { event.preventDefault(); onClose(); }} onMouseDown={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
      <div className="player-editor__surface"><button className="player-editor__close" type="button" aria-label="Close profile editor" onClick={onClose}><X size={18} aria-hidden="true" /></button><div className="player-editor__intro"><PlayerAvatar user={profileUser} /><div><p className="pp-eyebrow"><Pencil size={12} aria-hidden="true" />MAKE IT YOURS</p><h2 id="pp-edit-title">Your card. Your story.</h2></div></div><p id="pp-edit-description">A few details that make this corner of the arena yours.</p>
      <form onSubmit={save} aria-busy={saving}>
        {error && <div className="player-editor__error" role="alert"><CircleAlert size={15} aria-hidden="true" /><span>{error}</span></div>}
        <div className="player-editor__field"><label htmlFor="pp-edit-username">Username</label><input id="pp-edit-username" name="username" autoComplete="username" autoFocus required minLength={3} maxLength={20} value={username} onChange={(event) => setUsername(event.target.value)} disabled={saving} /></div>
        <div className="player-editor__field"><label htmlFor="pp-edit-avatar">Avatar URL <span>Optional</span></label><input id="pp-edit-avatar" name="avatar" type="url" placeholder="https://example.com/your-avatar.png" value={avatar} onChange={(event) => setAvatar(event.target.value)} disabled={saving} /></div>
        <div className="player-editor__field"><label htmlFor="pp-edit-college">College or organisation <span>Optional</span></label><input id="pp-edit-college" name="college" placeholder="Where you learn, build, or belong" value={college} onChange={(event) => setCollege(event.target.value)} disabled={saving} /></div>
        <div className="player-editor__field"><label htmlFor="pp-edit-bio">Your story <span>Optional</span></label><textarea id="pp-edit-bio" name="bio" rows={3} placeholder="A little about the person behind the code…" value={bio} onChange={(event) => setBio(event.target.value)} disabled={saving} /></div>
        <div className="player-editor__actions"><button type="button" className="pp-button" onClick={onClose}>Cancel</button><button type="submit" className="pp-button pp-button--primary" disabled={saving}>{saving ? <LoaderCircle size={14} className="pp-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}{saving ? "Saving your story…" : "Save changes"}</button></div>
      </form></div>
    </dialog>, document.body,
  );
}
